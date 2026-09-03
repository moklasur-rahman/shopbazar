"""
সব টেস্টের জন্য সাধারণ fixture।

প্রতিটা টেস্ট আলাদা, খালি ডেটাবেসে চলে — একটার ডেটা আরেকটাকে
প্রভাবিত করে না। তাই যা যা লাগে সব এখানে তৈরি করে দেওয়া হয়।
"""

from decimal import Decimal

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.catalog.models import Category, Product, ProductImage, ProductVariant
from apps.promotions.models import Coupon
from apps.vendors.models import Vendor, VendorKYC


@pytest.fixture
def api():
    return APIClient()


def auth_client(user):
    client = APIClient()
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


# ------------------------------------------------------------- ইউজার


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        phone="01711111111", password="testpass123", full_name="রাকিব হাসান",
    )


@pytest.fixture
def staff(db):
    return User.objects.create_user(
        phone="01700000000", password="testpass123", full_name="অ্যাডমিন",
        role=User.Role.STAFF, is_staff=True,
    )


@pytest.fixture
def customer_client(customer):
    return auth_client(customer)


@pytest.fixture
def staff_client(staff):
    return auth_client(staff)


# ------------------------------------------------------------- দোকান


def make_vendor(phone, shop_name, slug, commission="8", approved=True, with_kyc=True):
    owner = User.objects.create_user(
        phone=phone, password="testpass123", full_name=shop_name, role=User.Role.VENDOR,
    )
    vendor = Vendor.objects.create(
        owner=owner,
        shop_name=shop_name,
        slug=slug,
        district="ঢাকা",
        status=Vendor.Status.APPROVED if approved else Vendor.Status.PENDING,
        is_verified=approved,
        commission_rate=Decimal(commission),
    )
    if with_kyc:
        VendorKYC.objects.create(
            vendor=vendor, nid_number="1990123456789", bkash_number=phone,
        )
    return vendor


@pytest.fixture
def vendor_a(db):
    """৮% কমিশন — ইলেকট্রনিক্সের দোকান।"""
    return make_vendor("01722222222", "টেকজোন বিডি", "techzone-bd", commission="8")


@pytest.fixture
def vendor_b(db):
    """৬% কমিশন — বইয়ের দোকান।"""
    return make_vendor("01733333333", "রূপকথা বইঘর", "rupkotha-boi", commission="6")


@pytest.fixture
def pending_vendor(db):
    return make_vendor(
        "01744444444", "নতুন দোকান", "notun-dokan", approved=False, with_kyc=False,
    )


@pytest.fixture
def vendor_a_client(vendor_a):
    return auth_client(vendor_a.owner)


# -------------------------------------------------------------- পণ্য


@pytest.fixture
def category(db):
    return Category.objects.create(name="ইলেকট্রনিক্স", slug="electronics", icon="📱")


def make_product(vendor, category, title, slug, price, stock, status="live"):
    product = Product.objects.create(
        vendor=vendor, category=category, title=title, slug=slug, status=status,
    )
    ProductImage.objects.create(product=product, image_url="https://example.com/a.jpg")
    ProductVariant.objects.create(
        product=product,
        sku=f"{slug.upper()}-STD",
        options={},
        price=Decimal(price),
        stock=stock,
    )
    product.refresh_from_db()
    return product


@pytest.fixture
def phone_product(vendor_a, category):
    """৳২০,০০০ — ফ্রি ডেলিভারির সীমার (৳২০০০) উপরে।"""
    return make_product(vendor_a, category, "একটা ফোন", "ekta-phone", "20000", 5)


@pytest.fixture
def book_product(vendor_b, category):
    """৳৩০০ — সীমার নিচে, তাই ডেলিভারি চার্জ লাগবে।"""
    return make_product(vendor_b, category, "একটা বই", "ekta-boi", "300", 10)


@pytest.fixture
def address():
    return {
        "receiver_name": "রাকিব হাসান",
        "phone": "01711111111",
        "division": "ঢাকা",
        "district": "ঢাকা",
        "thana": "ধানমন্ডি",
        "address_line": "বাসা ১২, রোড ৫",
        "note": "",
    }


@pytest.fixture
def flat_coupon(db):
    return Coupon.objects.create(
        code="SAVE100", label="৳১০০ ছাড়", type=Coupon.Kind.FLAT,
        value=Decimal("100"), min_order=Decimal("1000"),
    )
