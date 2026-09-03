"""
নিরাপত্তার টেস্ট — কে কী দেখতে পারে না।

মাল্টি-ভেন্ডর সাইটে সবচেয়ে সাধারণ বাগ হলো একজন বিক্রেতা অন্যজনের
ডেটা দেখে ফেলা। এই টেস্টগুলো সেটা পাহারা দেয়। কেউ ভুল করে
`get_queryset()` থেকে ফিল্টার তুলে দিলে এখানেই ধরা পড়বে।
"""

import pytest

from apps.orders.services import place_order

pytestmark = pytest.mark.django_db


def items_for(product, qty=1):
    return [{"variant": product.variants.first().id, "quantity": qty}]


class TestVendorPanelAccess:
    """ভেন্ডর প্যানেলে কে ঢুকতে পারে।"""

    @pytest.mark.parametrize(
        "path",
        ["/api/v1/vendor/stats/", "/api/v1/vendor/products/", "/api/v1/vendor/orders/"],
    )
    def test_login_chhara_401(self, api, path):
        assert api.get(path).status_code == 401

    @pytest.mark.parametrize(
        "path",
        ["/api/v1/vendor/stats/", "/api/v1/vendor/products/", "/api/v1/vendor/orders/"],
    )
    def test_kreta_403(self, customer_client, path):
        assert customer_client.get(path).status_code == 403

    def test_onumodito_noy_emon_vendor_403(self, pending_vendor):
        from tests.conftest import auth_client

        client = auth_client(pending_vendor.owner)
        assert client.get("/api/v1/vendor/stats/").status_code == 403

    def test_pending_vendor_nijer_abedon_dekhte_pare(self, pending_vendor):
        """অনুমোদনের অপেক্ষায় থাকলেও নিজের আবেদন দেখা যাবে।"""
        from tests.conftest import auth_client

        client = auth_client(pending_vendor.owner)
        response = client.get("/api/v1/vendor/application/")
        assert response.status_code == 200
        assert response.data["vendor"]["status"] == "pending"


class TestVendorDataIsolation:
    """একজন ভেন্ডর অন্যজনের কিছু দেখতে পারে না।"""

    def test_shudhu_nijer_ponno(self, vendor_a_client, phone_product, book_product):
        response = vendor_a_client.get("/api/v1/vendor/products/")
        titles = [p["title"] for p in response.data["results"]]

        assert "একটা ফোন" in titles       # নিজের
        assert "একটা বই" not in titles     # অন্য দোকানের

    def test_shudhu_nijer_parcel(
        self, vendor_a_client, customer, phone_product, book_product, address
    ):
        place_order(
            customer,
            items_for(phone_product) + items_for(book_product),
            address,
        )

        response = vendor_a_client.get("/api/v1/vendor/orders/")
        vendors = {p["vendor"]["slug"] for p in response.data["results"]}
        assert vendors == {"techzone-bd"}

    def test_onno_vendor_er_ponno_bodlano_jay_na(
        self, vendor_a_client, book_product
    ):
        """অন্য দোকানের পণ্যের আইডি বসালেও ৪০৪ — কারণ queryset ফিল্টার করা।"""
        response = vendor_a_client.patch(
            f"/api/v1/vendor/products/{book_product.id}/",
            {"title": "দখল করা পণ্য", "category": "electronics", "price": 10, "stock": 1},
            format="json",
        )
        assert response.status_code == 404


class TestCustomerOrderIsolation:
    def test_onner_order_dekha_jay_na(
        self, customer, phone_product, address, vendor_a_client
    ):
        order = place_order(customer, items_for(phone_product), address)
        response = vendor_a_client.get(f"/api/v1/orders/{order.order_number}/")
        assert response.status_code == 404

    def test_login_chhara_order_dekha_jay_na(self, api):
        assert api.get("/api/v1/orders/").status_code == 401


class TestAdminAccess:
    ADMIN_PATHS = [
        "/api/v1/admin/stats/",
        "/api/v1/admin/vendors/",
        "/api/v1/admin/products/",
        "/api/v1/admin/orders/",
        "/api/v1/admin/categories/",
        "/api/v1/admin/coupons/",
        "/api/v1/admin/users/",
        "/api/v1/admin/settings/",
        "/api/v1/admin/reports/sales/",
    ]

    @pytest.mark.parametrize("path", ADMIN_PATHS)
    def test_login_chhara_401(self, api, path):
        assert api.get(path).status_code == 401

    @pytest.mark.parametrize("path", ADMIN_PATHS)
    def test_kreta_403(self, customer_client, path):
        assert customer_client.get(path).status_code == 403

    @pytest.mark.parametrize("path", ADMIN_PATHS)
    def test_vendor_403(self, vendor_a_client, path):
        assert vendor_a_client.get(path).status_code == 403

    @pytest.mark.parametrize("path", ADMIN_PATHS)
    def test_staff_200(self, staff_client, path):
        assert staff_client.get(path).status_code == 200


class TestRegistrationCannotEscalate:
    def test_is_staff_pathiye_admin_hoya_jay_na(self, api):
        """রেজিস্ট্রেশনে is_staff পাঠালেও সেটা উপেক্ষা করা হয়।"""
        response = api.post(
            "/api/v1/auth/register/",
            {
                "full_name": "চালাক ব্যবহারকারী",
                "phone": "01755555555",
                "password": "testpass123",
                "role": "customer",
                "is_staff": True,
                "is_superuser": True,
            },
            format="json",
        )
        assert response.status_code == 201
        assert response.data["user"]["is_staff"] is False

        from apps.accounts.models import User

        user = User.objects.get(phone="01755555555")
        assert not user.is_staff and not user.is_superuser

    def test_role_staff_pathale_o_is_staff_hoy_na(self, api):
        response = api.post(
            "/api/v1/auth/register/",
            {
                "full_name": "আরেকজন", "phone": "01766666666",
                "password": "testpass123", "role": "staff",
            },
            format="json",
        )
        # role এর choice-এ staff নেই, তাই ৪০০
        assert response.status_code == 400


class TestPasswordRules:
    def test_choto_password_atkay(self, api):
        response = api.post(
            "/api/v1/auth/register/",
            {"full_name": "ছোট পাস", "phone": "01777777777", "password": "1234"},
            format="json",
        )
        assert response.status_code == 400
        assert "password" in response.data
