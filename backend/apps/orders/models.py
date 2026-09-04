"""
মাল্টি-ভেন্ডর অর্ডারের কাঠামো — তিন স্তর।

    Order            ← ক্রেতার কাছে একটাই অর্ডার, একবার পেমেন্ট
      └── VendorOrder ← প্রতি দোকানের আলাদা পার্সেল, নিজস্ব স্ট্যাটাস ও টাকা
            └── OrderItem

সিঙ্গেল-স্টোর সাইটে মাঝের স্তরটা থাকে না। মাল্টি-ভেন্ডরে এটা বাদ দিলে
প্রতিটি বিক্রেতাকে আলাদা স্ট্যাটাস, আলাদা কুরিয়ার আর আলাদা পেমেন্ট দেওয়া
অসম্ভব হয়ে যায় — আর পরে যোগ করা প্রায় অসম্ভব।
"""

from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils.crypto import get_random_string

from apps.catalog.models import ProductVariant
from apps.promotions.models import Coupon
from apps.vendors.models import Vendor
from common.models import TimeStamped


def make_order_number():
    return f"SB-{get_random_string(6, '0123456789')}"


class Order(TimeStamped):
    class PaymentStatus(models.TextChoices):
        PENDING = "pending", "অপেক্ষমাণ"
        PAID = "paid", "পরিশোধিত"
        REFUNDED = "refunded", "ফেরত"
        FAILED = "failed", "ব্যর্থ"

    PAYMENT_METHODS = [
        ("cod", "ক্যাশ অন ডেলিভারি"),
        ("bkash", "বিকাশ"),
        ("nagad", "নগদ"),
        ("card", "কার্ড / ব্যাংক"),
    ]

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="orders"
    )
    order_number = models.CharField(max_length=20, unique=True, default=make_order_number)

    # ঠিকানার কপি — Address-এর FK নয়। ক্রেতা পরে ঠিকানা বদলালেও
    # পুরোনো অর্ডারে যেখানে পাঠানো হয়েছিল সেটাই থাকবে।
    shipping_address = models.JSONField(default=dict)

    payment_method = models.CharField(max_length=10, choices=PAYMENT_METHODS, default="cod")
    payment_status = models.CharField(
        max_length=10, choices=PaymentStatus.choices, default=PaymentStatus.PENDING
    )

    coupon = models.ForeignKey(
        Coupon, on_delete=models.SET_NULL, null=True, blank=True, related_name="orders"
    )

    # ক্রেতার ব্রাউজার প্রতিটি চেকআউটের জন্য একটা এলোমেলো কি তৈরি করে পাঠায়।
    # "অর্ডার করুন" দুইবার চাপলে, বা নেটওয়ার্ক টাইমআউটের পর রিকোয়েস্টটা
    # আবার গেলে — একই কি আসে, আর নিচের ইউনিক কনস্ট্রেইন্ট দ্বিতীয় অর্ডারটা
    # তৈরি হতে দেয় না। এটা ছাড়া একই কেনাকাটায় দুইবার স্টক কমত আর
    # (অনলাইন পেমেন্টে) দুইবার টাকা কাটত।
    #
    # খালি স্ট্রিং মানে কি পাঠানো হয়নি (পুরোনো অর্ডার, বা অন্য ক্লায়েন্ট) —
    # তখন কনস্ট্রেইন্টটা খাটে না, নইলে একজনের দ্বিতীয় অর্ডারই আটকে যেত।
    idempotency_key = models.CharField(max_length=64, blank=True, default="")

    items_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    shipping_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    discount_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    grand_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))

    class Meta:
        verbose_name = "অর্ডার"
        verbose_name_plural = "অর্ডার"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["customer", "idempotency_key"],
                condition=~models.Q(idempotency_key=""),
                name="uniq_order_idempotency_per_customer",
            )
        ]

    def __str__(self):
        return self.order_number

    def recalculate(self, save=True):
        """সব পার্সেলের যোগফলই মূল অর্ডারের হিসাব।"""
        parcels = list(self.vendor_orders.all())
        self.items_total = sum((p.subtotal for p in parcels), Decimal("0"))
        self.shipping_total = sum((p.shipping_fee for p in parcels), Decimal("0"))
        self.discount_total = sum((p.discount for p in parcels), Decimal("0"))
        self.grand_total = self.items_total - self.discount_total + self.shipping_total
        if save:
            self.save(update_fields=[
                "items_total", "shipping_total", "discount_total", "grand_total", "updated_at",
            ])
        return self

    @property
    def derived_status(self):
        """
        মূল অর্ডারের কোনো নিজস্ব স্ট্যাটাস নেই — পার্সেলগুলো থেকে বের করা হয়।
        এক দোকান ডেলিভারি করেছে আর আরেকজন করেনি, এমন অবস্থায় একটামাত্র
        কলামে সত্যিটা লেখা যায় না, তাই কলামই রাখা হয়নি।
        """
        statuses = [p.status for p in self.vendor_orders.all()]
        if not statuses:
            return VendorOrder.Status.PENDING
        if all(s == VendorOrder.Status.DELIVERED for s in statuses):
            return VendorOrder.Status.DELIVERED
        if all(s == VendorOrder.Status.CANCELLED for s in statuses):
            return VendorOrder.Status.CANCELLED
        for candidate in (VendorOrder.Status.SHIPPED, VendorOrder.Status.PACKED,
                          VendorOrder.Status.CONFIRMED):
            if candidate in statuses:
                return candidate
        return VendorOrder.Status.PENDING


class VendorOrder(TimeStamped):
    """ভেন্ডর প্যানেলে এটাই "অর্ডার"। ভেন্ডর কখনো মূল Order দেখে না।"""

    class Status(models.TextChoices):
        PENDING = "pending", "অপেক্ষমাণ"
        CONFIRMED = "confirmed", "নিশ্চিত"
        PACKED = "packed", "প্যাক হয়েছে"
        SHIPPED = "shipped", "পাঠানো হয়েছে"
        DELIVERED = "delivered", "ডেলিভারি হয়েছে"
        CANCELLED = "cancelled", "বাতিল"
        RETURNED = "returned", "ফেরত"

    #: ভেন্ডর শুধু এক ধাপ করে সামনে এগোতে পারে
    FLOW = [Status.PENDING, Status.CONFIRMED, Status.PACKED, Status.SHIPPED, Status.DELIVERED]

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="vendor_orders")
    vendor = models.ForeignKey(Vendor, on_delete=models.PROTECT, related_name="vendor_orders")
    sub_number = models.CharField(max_length=24)

    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)

    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    shipping_fee = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    commission_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    payable = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))

    courier = models.CharField(max_length=60, blank=True)
    tracking_code = models.CharField(max_length=60, blank=True)
    cancel_reason = models.CharField(max_length=200, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    settled = models.BooleanField(default=False, help_text="লেজারে এন্ট্রি বসানো হয়েছে কি না")

    class Meta:
        verbose_name = "পার্সেল (ভেন্ডর অর্ডার)"
        verbose_name_plural = "পার্সেল (ভেন্ডর অর্ডার)"
        ordering = ["id"]

    def __str__(self):
        return self.sub_number

    @property
    def customer_total(self):
        """ক্রেতা এই পার্সেলের জন্য যত টাকা দিচ্ছেন।"""
        return self.subtotal - self.discount + self.shipping_fee

    def next_status(self):
        try:
            index = self.FLOW.index(self.status)
        except ValueError:
            return None
        return self.FLOW[index + 1] if index < len(self.FLOW) - 1 else None

    def can_cancel(self):
        # প্যাক হয়ে যাওয়ার পর আর বাতিল করা যায় না
        return self.status in {self.Status.PENDING, self.Status.CONFIRMED}


class OrderItem(TimeStamped):
    """
    Order-এ নয়, VendorOrder-এ ঝোলে।

    নাম, ছবি আর দাম কপি করে রাখা হয় (snapshot) — ভেন্ডর পরে দাম বদলালে
    বা পণ্য মুছে ফেললেও পুরোনো ইনভয়েস অবিকৃত থাকবে।
    """

    vendor_order = models.ForeignKey(
        VendorOrder, on_delete=models.CASCADE, related_name="items"
    )
    variant = models.ForeignKey(
        ProductVariant, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="order_items",
    )

    product_title = models.CharField(max_length=200)
    product_slug = models.SlugField(max_length=220, blank=True)
    image = models.CharField(max_length=500, blank=True)
    options = models.JSONField(default=dict, blank=True)

    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    quantity = models.PositiveIntegerField(default=1)

    class Meta:
        verbose_name = "অর্ডারের পণ্য"
        verbose_name_plural = "অর্ডারের পণ্য"
        ordering = ["id"]

    def __str__(self):
        return f"{self.product_title} × {self.quantity}"

    @property
    def line_total(self):
        return self.unit_price * self.quantity

    @property
    def can_review(self):
        return (
            self.vendor_order.status == VendorOrder.Status.DELIVERED
            and not hasattr(self, "review")
        )
