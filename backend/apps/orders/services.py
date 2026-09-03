"""
মার্কেটপ্লেসের পুরো টাকার হিসাব — এক জায়গায়।

এই ফাইলটা ফ্রন্টএন্ডের `src/lib/pricing.js` এর হুবহু অনুবাদ। দুই জায়গার
নিয়ম এক না থাকলে ক্রেতা কার্টে এক টাকা দেখবে আর চেকআউটে আরেক — তাই
একটা বদলালে অন্যটাও বদলাতে হবে।

চূড়ান্ত হিসাব সবসময় এখানেই হয়। ফ্রন্টএন্ডের হিসাব শুধু সাথে সাথে
দেখানোর জন্য — ব্রাউজার থেকে পাঠানো দাম কখনো বিশ্বাস করা হয় না।
"""

from collections import OrderedDict
from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.catalog.models import ProductVariant
from apps.payouts.models import LedgerEntry

from .models import Order, OrderItem, VendorOrder, make_order_number

RULES = settings.MARKETPLACE


class OutOfStock(ValidationError):
    """স্টক শেষ — DRF এটাকে ৪০০ বানিয়ে ফ্রন্টএন্ডে পাঠাবে।"""


def taka(value):
    """পূর্ণ টাকায় গোল করা — JS-এর Math.round() এর মতো আচরণ।"""
    return Decimal(value).quantize(Decimal("1"), rounding=ROUND_HALF_UP)


def paisa(value):
    return Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


# ------------------------------------------------------------------ শিপিং


def shipping_for_vendor(index, vendor_subtotal, inside_dhaka):
    """
    প্রতি ভেন্ডরের ডেলিভারি চার্জ।

    ১. ঢাকার ভেতরে ৳৬০, বাইরে ৳১২০
    ২. প্রথম পার্সেল পুরো চার্জ, পরের প্রতিটা অর্ধেক — তিন দোকান থেকে কিনলে
       ক্রেতা যেন তিনগুণ চার্জ দেখে অর্ডার ছেড়ে না যান
    ৩. কোনো দোকান থেকে ৳২০০০-এর বেশি কিনলে সেই পার্সেল ফ্রি
    """
    if vendor_subtotal >= RULES["FREE_SHIPPING_THRESHOLD"]:
        return Decimal("0")

    base = RULES["SHIPPING_INSIDE_DHAKA"] if inside_dhaka else RULES["SHIPPING_OUTSIDE_DHAKA"]
    if index == 0:
        return base
    return taka(base * RULES["SHIPPING_EXTRA_VENDOR_MULTIPLIER"])


def is_inside_dhaka(district):
    return (district or "").strip() == RULES["DHAKA_DISTRICT"]


# ------------------------------------------------------------------- কুপন


def apply_coupon(coupon, groups):
    """
    কুপন কতটা ছাড় দেবে।

    coupon.vendor বসানো থাকলে ছাড় শুধু ওই দোকানের পণ্যের উপরে বসে এবং
    খরচটা ওই ভেন্ডরের; খালি থাকলে পুরো কার্টে বসে আর খরচ প্ল্যাটফর্মের।

    ফেরত দেয়: (ok, amount, reason)
    """
    if coupon is None:
        return True, Decimal("0"), None

    problem = coupon.check_usable()
    if problem:
        return False, Decimal("0"), problem

    if coupon.vendor_id:
        scope = [g for g in groups if g["vendor"].id == coupon.vendor_id]
    else:
        scope = groups

    if not scope:
        return False, Decimal("0"), "এই কুপন আপনার কার্টের পণ্যে চলবে না"

    base = sum((g["items_total"] for g in scope), Decimal("0"))

    if coupon.min_order and base < coupon.min_order:
        return False, Decimal("0"), f"কমপক্ষে ৳{int(coupon.min_order)} টাকার কেনাকাটা লাগবে"

    if coupon.type == coupon.Kind.PERCENT:
        amount = base * coupon.value / Decimal("100")
    else:
        amount = coupon.value

    if coupon.max_discount:
        amount = min(amount, coupon.max_discount)
    amount = min(amount, base)  # ছাড় কখনো পণ্যমূল্যের বেশি নয়

    return True, taka(amount), None


# ---------------------------------------------------------------- হিসাব


def load_lines(items):
    """
    [{variant, quantity}] → ডেটাবেস থেকে আসল ভ্যারিয়েন্টসহ লাইন।

    দাম ক্লায়েন্ট থেকে নেওয়া হয় না — সবসময় ডেটাবেস থেকে পড়া হয়।
    """
    if not items:
        raise ValidationError({"items": "কার্ট খালি।"})

    wanted = OrderedDict()
    for row in items:
        variant_id = row.get("variant")
        quantity = int(row.get("quantity") or 0)
        if not variant_id or quantity <= 0:
            raise ValidationError({"items": "প্রতিটি আইটেমে variant ও quantity দিতে হবে।"})
        if quantity > RULES["MAX_QTY_PER_ITEM"]:
            raise ValidationError(
                {"items": f"একটি পণ্যের সর্বোচ্চ {RULES['MAX_QTY_PER_ITEM']}টি নেওয়া যাবে।"}
            )
        wanted[variant_id] = wanted.get(variant_id, 0) + quantity

    variants = ProductVariant.objects.filter(id__in=wanted).select_related(
        "product__vendor", "product__category"
    ).prefetch_related("product__images")

    found = {v.id: v for v in variants}
    missing = [str(vid) for vid in wanted if vid not in found]
    if missing:
        raise ValidationError({"items": f"পণ্য পাওয়া যায়নি (variant {', '.join(missing)})।"})

    lines = []
    for variant_id, quantity in wanted.items():
        variant = found[variant_id]
        product = variant.product
        if not product.is_live:
            raise ValidationError({"items": f"“{product.title}” এখন বিক্রির জন্য নেই।"})
        lines.append({"variant": variant, "product": product, "quantity": quantity})
    return lines


def group_by_vendor(lines):
    """
    কার্টকে দোকান অনুযায়ী ভাগ করা — এটাই VendorOrder তৈরির ভিত্তি।
    OrderedDict ব্যবহার করা হয়েছে যাতে ক্রম স্থির থাকে; ডেলিভারি চার্জ
    ক্রমের উপর নির্ভর করে (প্রথম পার্সেল পুরো চার্জ)।
    """
    buckets = OrderedDict()
    for line in lines:
        vendor = line["product"].vendor
        bucket = buckets.setdefault(vendor.id, {"vendor": vendor, "lines": []})
        bucket["lines"].append(line)

    groups = []
    for bucket in buckets.values():
        items_total = sum(
            (paisa(l["variant"].price * l["quantity"]) for l in bucket["lines"]),
            Decimal("0"),
        )
        groups.append({
            "vendor": bucket["vendor"],
            "lines": bucket["lines"],
            "items_total": items_total,
            "item_count": sum(l["quantity"] for l in bucket["lines"]),
        })
    return groups


def calculate(items, district, coupon=None):
    """
    কার্ট + জেলা + কুপন → পুরো হিসাব।
    চেকআউটের quote আর আসল অর্ডার — দুটোই এই একটাই ফাংশন ব্যবহার করে,
    তাই দেখানো টাকা আর কাটা টাকা কখনো আলাদা হয় না।
    """
    lines = load_lines(items)
    groups = group_by_vendor(lines)
    inside = is_inside_dhaka(district)

    # ধাপ ১ — প্রতি পার্সেলের ডেলিভারি চার্জ
    for index, group in enumerate(groups):
        group["shipping"] = shipping_for_vendor(index, group["items_total"], inside)

    items_total = sum((g["items_total"] for g in groups), Decimal("0"))
    shipping_total = sum((g["shipping"] for g in groups), Decimal("0"))

    # ধাপ ২ — কুপন
    ok, discount, reason = apply_coupon(coupon, groups)
    if not ok:
        discount = Decimal("0")

    # ধাপ ৩ — ছাড়টা পার্সেলগুলোর মধ্যে অনুপাতে ভাগ করা।
    # এটা না করলে প্রতি ভেন্ডরের কমিশন ভুল হিসাব হবে।
    if coupon is not None and coupon.vendor_id:
        discount_base = sum(
            (g["items_total"] for g in groups if g["vendor"].id == coupon.vendor_id),
            Decimal("0"),
        )
    else:
        discount_base = items_total

    for group in groups:
        eligible = coupon is None or not coupon.vendor_id or coupon.vendor_id == group["vendor"].id
        if eligible and discount_base > 0 and discount:
            group["discount"] = taka(group["items_total"] / discount_base * discount)
        else:
            group["discount"] = Decimal("0")
        group["payable_total"] = group["items_total"] - group["discount"] + group["shipping"]

    return {
        "groups": groups,
        "items_total": items_total,
        "shipping_total": shipping_total,
        "discount_total": discount,
        "grand_total": max(Decimal("0"), items_total - discount + shipping_total),
        "coupon_error": reason,
    }


# --------------------------------------------------------- অর্ডার তৈরি


def first_image_url(product):
    image = product.images.first()
    return (image.display_url or "") if image else ""


@transaction.atomic
def place_order(user, items, address, payment_method="cod", coupon=None):
    """
    অর্ডার তৈরির একমাত্র পথ।

    পুরোটা একটাই ট্রানজেকশনে — মাঝপথে স্টক শেষ হলে সব রোলব্যাক হয়ে যায়,
    অর্ধেক তৈরি অর্ডার ডেটাবেসে পড়ে থাকে না।
    """
    summary = calculate(items, address.get("district"), coupon)

    order = Order.objects.create(
        customer=user,
        order_number=make_order_number(),
        shipping_address=address,
        payment_method=payment_method,
        payment_status=(
            Order.PaymentStatus.PENDING if payment_method == "cod" else Order.PaymentStatus.PAID
        ),
        coupon=coupon,
    )

    for index, group in enumerate(summary["groups"]):
        vendor = group["vendor"]
        vendor_order = VendorOrder.objects.create(
            order=order,
            vendor=vendor,
            sub_number=f"{order.order_number}-{chr(65 + index)}",
            subtotal=group["items_total"],
            discount=group["discount"],
            shipping_fee=group["shipping"],
        )

        for line in group["lines"]:
            variant = line["variant"]
            quantity = line["quantity"]

            # 🔒 সারিটা লক করে তবেই স্টক কমানো হয়। এটা ছাড়া শেষ ১টা পণ্যে
            # দুইজন একসাথে অর্ডার করলে দুজনেরই সফল হয়ে স্টক ঋণাত্মক হয়ে যাবে।
            locked = ProductVariant.objects.select_for_update().get(pk=variant.pk)
            if locked.stock < quantity:
                raise OutOfStock(
                    {"items": f"“{line['product'].title}” এর স্টক শেষ হয়ে গেছে।"}
                )

            locked.stock -= quantity
            locked.save(update_fields=["stock", "updated_at"])

            OrderItem.objects.create(
                vendor_order=vendor_order,
                variant=locked,
                product_title=line["product"].title,   # snapshot
                product_slug=line["product"].slug,
                image=first_image_url(line["product"]),
                options=locked.options,
                unit_price=locked.price,               # snapshot
                quantity=quantity,
            )

            line["product"].sold_count = line["product"].sold_count + quantity
            line["product"].save(update_fields=["sold_count", "updated_at"])

        # কমিশন এখনই হিসাব করে রাখা হয়, কিন্তু লেজারে বসে না —
        # সেটা হয় ডেলিভারির পর, settle_vendor_order() থেকে।
        rate = vendor.commission_for(group["lines"][0]["product"].category.slug)
        net_sales = group["items_total"] - group["discount"]
        vendor_order.commission_amount = taka(net_sales * rate / Decimal("100"))
        vendor_order.payable = net_sales - vendor_order.commission_amount
        vendor_order.save(update_fields=["commission_amount", "payable", "updated_at"])

    if coupon is not None and summary["discount_total"] > 0:
        coupon.used_count += 1
        coupon.save(update_fields=["used_count", "updated_at"])

    return order.recalculate()


# ------------------------------------------------------------- সেটেলমেন্ট


def settle_vendor_order(vendor_order):
    """
    ডেলিভারি হওয়ার পর ভেন্ডরের লেজারে এন্ট্রি বসায়।

    দুইটা আলাদা এন্ট্রি — বিক্রি (+) আর কমিশন (−)। একটা নেট অঙ্ক না বসিয়ে
    দুইটা বসানোর কারণ: পরে রিপোর্টে "মোট বিক্রি" আর "মোট কমিশন" আলাদা করে
    বের করা যায়।

    টাকা সাথে সাথে তোলা যায় না — release_at বসে PAYOUT_HOLD_DAYS পরে,
    কারণ ওই সময়ে ক্রেতা পণ্য ফেরত দিতে পারেন।
    """
    if vendor_order.settled:
        return

    release_at = LedgerEntry.hold_until()
    net_sales = vendor_order.subtotal - vendor_order.discount

    LedgerEntry.objects.create(
        vendor=vendor_order.vendor,
        vendor_order=vendor_order,
        kind=LedgerEntry.Kind.SALE,
        amount=net_sales,
        release_at=release_at,
    )
    LedgerEntry.objects.create(
        vendor=vendor_order.vendor,
        vendor_order=vendor_order,
        kind=LedgerEntry.Kind.COMMISSION,
        amount=-vendor_order.commission_amount,
        release_at=release_at,
    )

    vendor_order.settled = True
    vendor_order.delivered_at = timezone.now()
    vendor_order.save(update_fields=["settled", "delivered_at", "updated_at"])


@transaction.atomic
def cancel_vendor_order(vendor_order, reason=""):
    """পার্সেল বাতিল — স্টক ফেরত যায়, টাকা থাকলে রিফান্ড এন্ট্রি বসে।"""
    if not vendor_order.can_cancel():
        raise ValidationError({"detail": "প্যাক হয়ে যাওয়ার পর আর বাতিল করা যায় না।"})

    for item in vendor_order.items.select_related("variant"):
        if item.variant_id:
            variant = ProductVariant.objects.select_for_update().get(pk=item.variant_id)
            variant.stock += item.quantity
            variant.save(update_fields=["stock", "updated_at"])

    if vendor_order.settled:
        LedgerEntry.objects.create(
            vendor=vendor_order.vendor,
            vendor_order=vendor_order,
            kind=LedgerEntry.Kind.REFUND,
            amount=-(vendor_order.subtotal - vendor_order.discount - vendor_order.commission_amount),
            release_at=timezone.now(),
            note="পার্সেল বাতিল",
        )

    vendor_order.status = VendorOrder.Status.CANCELLED
    vendor_order.cancel_reason = reason
    vendor_order.save(update_fields=["status", "cancel_reason", "updated_at"])
    vendor_order.order.recalculate()
    return vendor_order
