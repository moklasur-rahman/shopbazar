"""
ব্যাকএন্ডের নিয়ম আর `shared/business-rules.json` এক আছে কি না।

কেন দরকার
---------
টাকার হিসাব দুই জায়গায় লেখা — ফ্রন্টএন্ডে (দ্রুত দেখানোর জন্য) আর
ব্যাকএন্ডে (চূড়ান্ত হিসাব)। দুইটা আলাদা হয়ে গেলে ক্রেতা কার্টে এক টাকা
দেখবেন, চেকআউটে আরেক — আর সেটা কেউ ধরার আগেই অর্ডার হয়ে যাবে।

আগে READMEতে শুধু লেখা ছিল "দুই জায়গা মিলিয়ে রাখুন"। মানুষ ভুলে যায়;
টেস্ট ভোলে না। ফ্রন্টএন্ডেও ঠিক এই একই টেস্ট আছে —
`frontend/src/lib/business-rules.test.js`।
"""

import json
from decimal import Decimal
from pathlib import Path

from django.conf import settings

#: রিপোর কোথায় — backend/tests/ থেকে দুই ধাপ উপরে
SHARED = Path(__file__).resolve().parent.parent.parent / "shared" / "business-rules.json"


def load_rules():
    data = json.loads(SHARED.read_text(encoding="utf-8"))
    # "$" দিয়ে শুরু হওয়া কীগুলো শুধু মন্তব্য
    return {key: value for key, value in data.items() if not key.startswith("$")}


def test_shared_file_ache():
    assert SHARED.exists(), f"{SHARED} পাওয়া যায়নি"


def test_commission_mile():
    shared = load_rules()
    rules = settings.MARKETPLACE

    assert rules["DEFAULT_COMMISSION_RATE"] == Decimal(str(shared["defaultCommissionRate"]))

    for category, rate in shared["commissionByCategory"].items():
        assert rules["COMMISSION_BY_CATEGORY"][category] == Decimal(str(rate)), (
            f"'{category}' ক্যাটাগরির কমিশন মিলছে না"
        )

    # উল্টো দিকও — ব্যাকএন্ডে বাড়তি ক্যাটাগরি থাকলে ফ্রন্টএন্ড সেটা জানে না
    assert set(rules["COMMISSION_BY_CATEGORY"]) == set(shared["commissionByCategory"]), (
        "ক্যাটাগরির তালিকা দুই জায়গায় আলাদা"
    )


def test_delivery_charge_mile():
    shared = load_rules()["shipping"]
    rules = settings.MARKETPLACE

    assert rules["SHIPPING_INSIDE_DHAKA"] == Decimal(str(shared["insideDhaka"]))
    assert rules["SHIPPING_OUTSIDE_DHAKA"] == Decimal(str(shared["outsideDhaka"]))
    assert rules["SHIPPING_EXTRA_VENDOR_MULTIPLIER"] == Decimal(
        str(shared["extraVendorMultiplier"])
    )
    assert rules["FREE_SHIPPING_THRESHOLD"] == Decimal(str(shared["freeShippingThreshold"]))


def test_baki_niyom_mile():
    shared = load_rules()
    rules = settings.MARKETPLACE

    assert rules["PAYOUT_HOLD_DAYS"] == shared["payoutHoldDays"]
    assert rules["MAX_QTY_PER_ITEM"] == shared["maxQtyPerItem"]
    assert rules["LOW_STOCK_THRESHOLD"] == shared["lowStockThreshold"]

    # পেজ সাইজ DRF-এর সেটিংসে থাকে, MARKETPLACE-এ নয়
    assert settings.REST_FRAMEWORK["PAGE_SIZE"] == shared["pageSize"], (
        "ব্যাকএন্ডের পেজ সাইজ ফ্রন্টএন্ডের সাথে মিলছে না — "
        "তালিকার পাতায় গণনা এলোমেলো দেখাবে"
    )
