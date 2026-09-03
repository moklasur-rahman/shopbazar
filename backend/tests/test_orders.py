"""
অর্ডারের টেস্ট — মাল্টি-ভেন্ডরের মূল আচরণ।

যা যাচাই করা হয়:
  · এক অর্ডার কীভাবে দোকান অনুযায়ী পার্সেলে ভাগ হয়
  · প্রতি পার্সেলের ডেলিভারি চার্জ ও কমিশন
  · স্টক কমা, আর স্টক না থাকলে অর্ডার আটকানো
  · দাম ও নাম snapshot হিসেবে জমা থাকা
"""

from decimal import Decimal

import pytest

from apps.orders.models import Order, VendorOrder
from apps.orders.services import OutOfStock, place_order

pytestmark = pytest.mark.django_db


def items_for(*products_and_qty):
    return [
        {"variant": product.variants.first().id, "quantity": qty}
        for product, qty in products_and_qty
    ]


class TestOrderSplit:
    def test_dui_dokan_dui_parcel(self, customer, phone_product, book_product, address):
        order = place_order(
            customer, items_for((phone_product, 1), (book_product, 2)), address,
        )

        assert order.vendor_orders.count() == 2
        parcels = list(order.vendor_orders.order_by("id"))

        assert parcels[0].vendor == phone_product.vendor
        assert parcels[1].vendor == book_product.vendor
        # পার্সেলের নম্বর: SB-xxxxxx-A, -B
        assert parcels[0].sub_number.endswith("-A")
        assert parcels[1].sub_number.endswith("-B")

    def test_ek_dokan_ek_parcel(self, customer, phone_product, address):
        order = place_order(customer, items_for((phone_product, 2)), address)
        assert order.vendor_orders.count() == 1

    def test_delivery_charge_prothom_puro_porer_ordhek(
        self, customer, phone_product, book_product, address
    ):
        order = place_order(
            customer, items_for((phone_product, 1), (book_product, 1)), address,
        )
        phone_parcel, book_parcel = order.vendor_orders.order_by("id")

        # ফোন ৳২০,০০০ — ফ্রি সীমার উপরে
        assert phone_parcel.shipping_fee == Decimal("0")
        # বই ৳৩০০, দ্বিতীয় পার্সেল — ঢাকায় ৬০ এর অর্ধেক
        assert book_parcel.shipping_fee == Decimal("30")

    def test_dhakar_baire_beshi_charge(
        self, customer, book_product, address
    ):
        address = {**address, "district": "চট্টগ্রাম"}
        order = place_order(customer, items_for((book_product, 1)), address)
        assert order.vendor_orders.first().shipping_fee == Decimal("120")

    def test_commission_dokan_onujayi(
        self, customer, phone_product, book_product, address
    ):
        """টেকজোন ৮%, রূপকথা ৬% — প্রতি দোকানের নিজের হার।"""
        order = place_order(
            customer, items_for((phone_product, 1), (book_product, 2)), address,
        )
        phone_parcel, book_parcel = order.vendor_orders.order_by("id")

        assert phone_parcel.subtotal == Decimal("20000")
        assert phone_parcel.commission_amount == Decimal("1600")  # ৮%
        assert phone_parcel.payable == Decimal("18400")

        assert book_parcel.subtotal == Decimal("600")
        assert book_parcel.commission_amount == Decimal("36")  # ৬%
        assert book_parcel.payable == Decimal("564")

    def test_order_er_mot_hishab(self, customer, phone_product, book_product, address):
        order = place_order(
            customer, items_for((phone_product, 1), (book_product, 1)), address,
        )
        assert order.items_total == Decimal("20300")
        assert order.shipping_total == Decimal("30")
        assert order.grand_total == Decimal("20330")


class TestCouponSplit:
    def test_chhar_parcel_gulor_moddhe_bhag_hoy(
        self, customer, phone_product, book_product, address, flat_coupon
    ):
        """
        ৳১০০ ছাড় দুই পার্সেলে অনুপাতে ভাগ হয় — নাহলে প্রতি ভেন্ডরের
        কমিশন ভুল হিসাব হতো।
        """
        order = place_order(
            customer,
            items_for((phone_product, 1), (book_product, 1)),
            address,
            coupon=flat_coupon,
        )
        parcels = list(order.vendor_orders.order_by("id"))
        total_discount = sum(p.discount for p in parcels)

        assert total_discount == Decimal("100")
        # ২০,০০০ : ৩০০ অনুপাতে — বেশিরভাগ ছাড় ফোনের পার্সেলে
        assert parcels[0].discount > parcels[1].discount
        assert order.discount_total == Decimal("100")

    def test_coupon_byabohar_gona_hoy(
        self, customer, phone_product, address, flat_coupon
    ):
        before = flat_coupon.used_count
        place_order(customer, items_for((phone_product, 1)), address, coupon=flat_coupon)
        flat_coupon.refresh_from_db()
        assert flat_coupon.used_count == before + 1


class TestStock:
    def test_stock_kome(self, customer, phone_product, address):
        variant = phone_product.variants.first()
        before = variant.stock

        place_order(customer, items_for((phone_product, 2)), address)

        variant.refresh_from_db()
        assert variant.stock == before - 2

    def test_stock_er_beshi_order_atkay(self, customer, phone_product, address):
        with pytest.raises(OutOfStock):
            place_order(customer, items_for((phone_product, 9)), address)

    def test_stock_shesh_hole_kono_order_toiri_hoy_na(
        self, customer, phone_product, book_product, address
    ):
        """
        দ্বিতীয় পণ্যের স্টক না থাকলে পুরো অর্ডারই বাতিল — অর্ধেক তৈরি
        অর্ডার ডেটাবেসে পড়ে থাকে না (transaction.atomic)।

        বইয়ের স্টক ১০ (যথেষ্ট), ফোনের স্টক ৫ কিন্তু ৯টা চাওয়া হচ্ছে।
        বইটা আগে প্রসেস হয়ে স্টক কমবে, তারপর ফোনে গিয়ে আটকাবে —
        তখন বইয়ের স্টকও ফেরত আসতে হবে।
        """
        before_orders = Order.objects.count()
        book_variant = book_product.variants.first()
        before_stock = book_variant.stock

        with pytest.raises(OutOfStock):
            place_order(
                customer, items_for((book_product, 2), (phone_product, 9)), address,
            )

        assert Order.objects.count() == before_orders
        book_variant.refresh_from_db()
        assert book_variant.stock == before_stock  # রোলব্যাক হয়েছে

    def test_sold_count_bare(self, customer, phone_product, address):
        before = phone_product.sold_count
        place_order(customer, items_for((phone_product, 3)), address)
        phone_product.refresh_from_db()
        assert phone_product.sold_count == before + 3


class TestSnapshot:
    def test_naam_o_dam_copy_hoye_thake(self, customer, phone_product, address):
        """ভেন্ডর পরে দাম বদলালেও পুরোনো অর্ডারের দাম বদলায় না।"""
        order = place_order(customer, items_for((phone_product, 1)), address)
        item = order.vendor_orders.first().items.first()

        assert item.product_title == "একটা ফোন"
        assert item.unit_price == Decimal("20000")

        variant = phone_product.variants.first()
        variant.price = Decimal("25000")
        variant.save()

        item.refresh_from_db()
        assert item.unit_price == Decimal("20000")  # অপরিবর্তিত

    def test_thikanao_snapshot(self, customer, phone_product, address):
        order = place_order(customer, items_for((phone_product, 1)), address)
        assert order.shipping_address["receiver_name"] == "রাকিব হাসান"
        assert order.shipping_address["district"] == "ঢাকা"


class TestDerivedStatus:
    def test_shob_delivered_hole_order_delivered(
        self, customer, phone_product, book_product, address
    ):
        order = place_order(
            customer, items_for((phone_product, 1), (book_product, 1)), address,
        )
        order.vendor_orders.update(status=VendorOrder.Status.DELIVERED)
        assert order.derived_status == VendorOrder.Status.DELIVERED

    def test_ekjon_pathale_order_shipped(
        self, customer, phone_product, book_product, address
    ):
        """এক দোকান পাঠিয়েছে, আরেকজন না — অর্ডার 'পথে আছে'।"""
        order = place_order(
            customer, items_for((phone_product, 1), (book_product, 1)), address,
        )
        first = order.vendor_orders.first()
        first.status = VendorOrder.Status.SHIPPED
        first.save()

        assert order.derived_status == VendorOrder.Status.SHIPPED
