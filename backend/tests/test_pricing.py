"""
টাকার হিসাবের টেস্ট — বিশুদ্ধ ফাংশন, ডেটাবেস লাগে না।

এই নিয়মগুলোই মার্কেটপ্লেসের মেরুদণ্ড। এখানে কিছু ভাঙলে ক্রেতা ভুল
টাকা দেবেন বা ভেন্ডর ভুল টাকা পাবেন — তাই সবচেয়ে বেশি টেস্ট এখানে।
"""

from decimal import Decimal

import pytest

from apps.orders.services import apply_coupon, is_inside_dhaka, shipping_for_vendor


class TestShipping:
    """ডেলিভারি চার্জের তিনটা নিয়ম।"""

    def test_dhakay_prothom_parcel_puro_charge(self):
        assert shipping_for_vendor(0, Decimal("500"), inside_dhaka=True) == Decimal("60")

    def test_dhakar_baire_beshi_charge(self):
        assert shipping_for_vendor(0, Decimal("500"), inside_dhaka=False) == Decimal("120")

    def test_ditiyo_parcel_ordhek_charge(self):
        """তিন দোকান থেকে কিনলে ক্রেতা যেন তিনগুণ চার্জ না দেখেন।"""
        assert shipping_for_vendor(1, Decimal("500"), inside_dhaka=True) == Decimal("30")
        assert shipping_for_vendor(2, Decimal("500"), inside_dhaka=True) == Decimal("30")
        assert shipping_for_vendor(1, Decimal("500"), inside_dhaka=False) == Decimal("60")

    def test_boro_order_e_free_delivery(self):
        """৳২০০০-এর উপরে হলে ওই পার্সেল ফ্রি — ক্রম যাই হোক।"""
        assert shipping_for_vendor(0, Decimal("2000"), inside_dhaka=True) == Decimal("0")
        assert shipping_for_vendor(3, Decimal("5000"), inside_dhaka=False) == Decimal("0")

    def test_thik_shimana(self):
        """১৯৯৯ টাকায় চার্জ লাগে, ২০০০ টাকায় লাগে না।"""
        assert shipping_for_vendor(0, Decimal("1999"), inside_dhaka=True) == Decimal("60")
        assert shipping_for_vendor(0, Decimal("2000"), inside_dhaka=True) == Decimal("0")

    @pytest.mark.parametrize(
        "district,expected",
        [("ঢাকা", True), ("চট্টগ্রাম", False), ("গাজীপুর", False), ("", False), (None, False)],
    )
    def test_dhaka_cinhito_hoy(self, district, expected):
        assert is_inside_dhaka(district) is expected


class FakeCoupon:
    """কুপনের নকল — ডেটাবেস ছাড়াই লজিক পরীক্ষা করতে।"""

    class Kind:
        FLAT = "flat"
        PERCENT = "percent"

    def __init__(self, **kwargs):
        self.type = kwargs.get("type", "flat")
        self.value = Decimal(str(kwargs.get("value", 100)))
        self.min_order = Decimal(str(kwargs.get("min_order", 0)))
        self.max_discount = (
            Decimal(str(kwargs["max_discount"])) if kwargs.get("max_discount") else None
        )
        self.vendor_id = kwargs.get("vendor_id")
        self._problem = kwargs.get("problem")

    def check_usable(self):
        return self._problem


def groups(*pairs):
    """(vendor_id, items_total) → services.apply_coupon যে আকার চায়।"""
    return [
        {"vendor": type("V", (), {"id": vid})(), "items_total": Decimal(str(total))}
        for vid, total in pairs
    ]


class TestCoupon:
    def test_flat_chhar(self):
        ok, amount, reason = apply_coupon(FakeCoupon(value=100), groups((1, 1000)))
        assert (ok, amount, reason) == (True, Decimal("100"), None)

    def test_percent_chhar(self):
        coupon = FakeCoupon(type="percent", value=15)
        ok, amount, _ = apply_coupon(coupon, groups((1, 2000)))
        assert ok and amount == Decimal("300")

    def test_max_discount_capped(self):
        """১৫% হলেও সর্বোচ্চ ৳৫০০ এর বেশি নয়।"""
        coupon = FakeCoupon(type="percent", value=15, max_discount=500)
        ok, amount, _ = apply_coupon(coupon, groups((1, 10000)))
        assert ok and amount == Decimal("500")

    def test_chhar_kokhono_ponnomullher_beshi_noy(self):
        coupon = FakeCoupon(value=5000)
        ok, amount, _ = apply_coupon(coupon, groups((1, 300)))
        assert ok and amount == Decimal("300")

    def test_min_order_na_hole_cholbe_na(self):
        coupon = FakeCoupon(value=100, min_order=1000)
        ok, amount, reason = apply_coupon(coupon, groups((1, 500)))
        assert not ok and amount == Decimal("0") and "কেনাকাটা" in reason

    def test_vendor_coupon_shudhu_oi_dokane(self):
        """দোকান-নির্দিষ্ট কুপন শুধু ওই দোকানের টাকার উপরে বসে।"""
        coupon = FakeCoupon(type="percent", value=10, vendor_id=1)
        ok, amount, _ = apply_coupon(coupon, groups((1, 1000), (2, 5000)))
        assert ok and amount == Decimal("100")  # ৫০০০ নয়, শুধু ১০০০-এর ১০%

    def test_onno_dokaner_coupon_cholbe_na(self):
        coupon = FakeCoupon(value=100, vendor_id=99)
        ok, _, reason = apply_coupon(coupon, groups((1, 1000)))
        assert not ok and "চলবে না" in reason

    def test_meyad_ba_shima_shesh(self):
        coupon = FakeCoupon(value=100, problem="কুপনের মেয়াদ শেষ")
        ok, amount, reason = apply_coupon(coupon, groups((1, 1000)))
        assert not ok and amount == Decimal("0") and reason == "কুপনের মেয়াদ শেষ"

    def test_coupon_na_thakle_shunno(self):
        ok, amount, reason = apply_coupon(None, groups((1, 1000)))
        assert ok and amount == Decimal("0") and reason is None
