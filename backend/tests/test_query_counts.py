"""
তালিকার পাতাগুলো কয়টা SQL কোয়েরি চালায় — তার সীমা।

কেন দরকার
---------
N+1 এমন সমস্যা যেটা ডেভেলপমেন্টে কখনো চোখে পড়ে না। ৫টা পণ্য থাকলে
৭টা কোয়েরি, সব ঠিকই মনে হয়। ৫০০টা পণ্য হলে ৫০২টা কোয়েরি — তখন
পাতা খুলতে ১০ সেকেন্ড, আর কেউ বুঝতেই পারে না কী হলো।

সিরিয়ালাইজারে একটা নিরীহ `obj.something.count()` লিখলেই এটা ফিরে
আসে। তাই সীমাটা টেস্টে বেঁধে রাখা — সংখ্যা বাড়লে CI বলে দেবে।

আসল ঘটনা: এই টেস্ট লেখার আগে `admin/categories/` ৩৬টা ক্যাটাগরির
জন্য ৩৮টা কোয়েরি চালাত, আর `admin/stats/` চালাত ১৯টা।

⚠️ সীমাগুলো ইচ্ছে করে একটু ঢিলা — এক-দুইটা কোয়েরি বাড়লেই যেন টেস্ট
ভাঙে না। কিন্তু N+1 ফিরে এলে সংখ্যা লাফিয়ে বাড়ে, তখনই ধরা পড়বে।
"""

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from tests.conftest import auth_client

pytestmark = pytest.mark.django_db


def count_queries(client, path):
    with CaptureQueriesContext(connection) as ctx:
        response = client.get(path)
    assert response.status_code == 200, f"{path} -> {response.status_code}"
    return len(ctx)


# (পথ, সর্বোচ্চ কোয়েরি)
PUBLIC_LIMITS = [
    ("/api/v1/catalog/products/", 8),
    ("/api/v1/catalog/categories/", 6),
    ("/api/v1/vendors/", 6),
]

ADMIN_LIMITS = [
    ("/api/v1/admin/stats/", 12),
    ("/api/v1/admin/vendors/", 6),
    ("/api/v1/admin/products/", 7),
    ("/api/v1/admin/orders/", 8),
    ("/api/v1/admin/users/", 6),
    ("/api/v1/admin/categories/", 5),
    ("/api/v1/admin/coupons/", 5),
    ("/api/v1/admin/banners/", 5),
]


@pytest.mark.parametrize("path,limit", PUBLIC_LIMITS)
def test_public_talikay_n_plus_1_nei(api, phone_product, book_product, path, limit):
    n = count_queries(api, path)
    assert n <= limit, f"{path} — {n}টি কোয়েরি, সীমা {limit}। N+1 ফিরে এসেছে?"


@pytest.mark.parametrize("path,limit", ADMIN_LIMITS)
def test_admin_talikay_n_plus_1_nei(staff, phone_product, book_product, path, limit):
    client = auth_client(staff)
    n = count_queries(client, path)
    assert n <= limit, f"{path} — {n}টি কোয়েরি, সীমা {limit}। N+1 ফিরে এসেছে?"


def test_data_barle_query_bare_na(staff, vendor_a):
    """
    আসল পরীক্ষা: সারি বাড়লে কোয়েরি বাড়ে কি না।

    উপরের সীমাগুলো ছোট ডেটায় মাপা। কিন্তু N+1-এর সংজ্ঞাই হলো
    "সারি বাড়লে কোয়েরিও বাড়ে" — সেটা এভাবেই ধরা যায়।
    """
    from apps.catalog.models import Category

    client = auth_client(staff)

    for i in range(3):
        Category.objects.create(name=f"ক্যাটাগরি {i}", slug=f"cat-{i}", sort_order=i)
    few = count_queries(client, "/api/v1/admin/categories/")

    for i in range(3, 20):
        Category.objects.create(name=f"ক্যাটাগরি {i}", slug=f"cat-{i}", sort_order=i)
    many = count_queries(client, "/api/v1/admin/categories/")

    assert few == many, (
        f"৩টি ক্যাটাগরিতে {few}টি কোয়েরি, ২০টিতে {many}টি — "
        "প্রতি সারিতে আলাদা কোয়েরি চলছে (N+1)"
    )
