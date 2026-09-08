"""
গেস্ট চেকআউট — অ্যাকাউন্ট ছাড়া ক্যাশ অন ডেলিভারিতে অর্ডার।

কেন এই সুবিধা: বাংলাদেশে অনেক ক্রেতা অ্যাকাউন্ট খুলতে চান না, আর
ক্যাশ অন ডেলিভারিতে তার দরকারও নেই — টাকা তো হাতে হাতে। জোর করে
রেজিস্ট্রেশন চাইলে অর্ডারটাই হারানোর ঝুঁকি।

যা পাহারা দিতে হয়:
  · লগইন ছাড়া **শুধু** cod, অনলাইন পেমেন্ট নয়
  · গেস্টের অর্ডার অন্য কেউ দেখতে না পারে
  · অর্ডার নম্বর অনুমান করে অন্যের ঠিকানা/ফোন বের করা না যায়
  · গেস্টের ক্ষেত্রেও দুইবার অর্ডার না হয় (idempotency)
"""

import pytest

from apps.orders.models import Order
from apps.orders.services import place_order
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db

ADDRESS = {
    "receiver_name": "করিম মিয়া",
    "phone": "01799999999",
    "division": "ঢাকা",
    "district": "ঢাকা",
    "thana": "মিরপুর",
    "address_line": "বাড়ি ৫, রোড ৩, মিরপুর ১১",
}


def payload(product, method="cod", **extra):
    return {
        "items": [{"variant": product.variants.first().id, "quantity": 1}],
        "shipping_address": ADDRESS,
        "payment_method": method,
        **extra,
    }


class TestGuestOrderKora:
    def test_login_chara_cod_e_order_kora_jay(self, api, phone_product):
        r = api.post("/api/v1/orders/", payload(phone_product), format="json")

        assert r.status_code == 201
        order = Order.objects.get(order_number=r.data["order_number"])
        assert order.customer_id is None
        assert order.is_guest is True
        assert order.contact_phone == "01799999999"

    def test_login_chara_online_payment_atkay(self, api, phone_product):
        """
        সবচেয়ে জরুরি নিয়ম। অনলাইন পেমেন্টে অ্যাকাউন্ট লাগেই — টাকা
        ফেরত দিতে হলে কাকে দেব, বিরোধ হলে কার সাথে কথা বলব?
        """
        for method in ("bkash", "nagad", "card"):
            r = api.post("/api/v1/orders/", payload(phone_product, method), format="json")
            assert r.status_code == 401, f"{method} লগইন ছাড়াই পাস করল"
            assert Order.objects.count() == 0

    def test_login_kora_kretar_order_e_customer_bose(self, customer, phone_product):
        client = auth_client(customer)
        r = client.post("/api/v1/orders/", payload(phone_product), format="json")

        assert r.status_code == 201
        order = Order.objects.get(order_number=r.data["order_number"])
        assert order.customer == customer
        assert order.is_guest is False

    def test_guest_order_stock_kombe(self, api, phone_product):
        variant = phone_product.variants.first()
        start = variant.stock
        api.post("/api/v1/orders/", payload(phone_product), format="json")
        variant.refresh_from_db()
        assert variant.stock == start - 1


class TestGuestIdempotency:
    def test_ek_key_e_ekbar_i_order(self, api, phone_product):
        """
        ⚠️ SQL-এ NULL কখনো NULL-এর সমান নয়।

        তাই (customer, idempotency_key) কনস্ট্রেইন্টটা গেস্ট অর্ডারে
        কাজ করত না — একই কি দিয়ে দুইবার অনুরোধ এলে দুইটা অর্ডারই
        তৈরি হয়ে যেত আর দুইবার স্টক কমত। গেস্টদের জন্য আলাদা
        কনস্ট্রেইন্ট বসানো হয়েছে; এই টেস্ট সেটাই পাহারা দেয়।
        """
        headers = {"HTTP_IDEMPOTENCY_KEY": "guest-checkout-1"}
        first = api.post("/api/v1/orders/", payload(phone_product), format="json", **headers)
        second = api.post("/api/v1/orders/", payload(phone_product), format="json", **headers)

        assert first.status_code == 201
        assert second.status_code == 200
        assert first.data["order_number"] == second.data["order_number"]
        assert Order.objects.count() == 1

    def test_dui_guest_er_alada_key_e_alada_order(self, api, phone_product):
        api.post("/api/v1/orders/", payload(phone_product), format="json",
                 **{"HTTP_IDEMPOTENCY_KEY": "g1"})
        api.post("/api/v1/orders/", payload(phone_product), format="json",
                 **{"HTTP_IDEMPOTENCY_KEY": "g2"})
        assert Order.objects.count() == 2

    def test_guest_er_key_login_kora_kretar_order_dhore_na(
        self, api, customer, phone_product
    ):
        """একই কি হলেও গেস্ট আর লগইন করা ক্রেতার অর্ডার আলাদা থাকবে।"""
        api.post("/api/v1/orders/", payload(phone_product), format="json",
                 **{"HTTP_IDEMPOTENCY_KEY": "same-key"})
        client = auth_client(customer)
        client.post("/api/v1/orders/", payload(phone_product), format="json",
                    **{"HTTP_IDEMPOTENCY_KEY": "same-key"})
        assert Order.objects.count() == 2


class TestTrackOrder:
    @pytest.fixture
    def guest_order(self, api, phone_product):
        r = api.post("/api/v1/orders/", payload(phone_product), format="json")
        return Order.objects.get(order_number=r.data["order_number"])

    def test_number_o_phone_dile_order_dekha_jay(self, api, guest_order):
        r = api.post(
            "/api/v1/orders/track/",
            {"order_number": guest_order.order_number, "phone": "01799999999"},
            format="json",
        )
        assert r.status_code == 200
        assert r.data["order_number"] == guest_order.order_number

    def test_bhul_phone_e_dekha_jay_na(self, api, guest_order):
        """
        অর্ডার নম্বর অনুমান করা সহজ (SB-000001, SB-000002…)। ফোন না
        মিললে দেখানো যাবে না — নইলে অন্যের নাম, ঠিকানা, ফোন সব
        বেরিয়ে যেত।
        """
        r = api.post(
            "/api/v1/orders/track/",
            {"order_number": guest_order.order_number, "phone": "01700000000"},
            format="json",
        )
        assert r.status_code == 404

    def test_bhul_phone_o_ojana_number_ek_i_uttor(self, api, guest_order):
        """
        দুই ক্ষেত্রে আলাদা বার্তা দিলে "নম্বরটা আসল কিন্তু ফোন ভুল"
        বোঝা যেত — সেটা দিয়েই কোন অর্ডার নম্বরগুলো সত্যি তা বের
        করা যেত।
        """
        wrong_phone = api.post(
            "/api/v1/orders/track/",
            {"order_number": guest_order.order_number, "phone": "01700000000"},
            format="json",
        )
        no_such = api.post(
            "/api/v1/orders/track/",
            {"order_number": "SB-000000", "phone": "01799999999"},
            format="json",
        )
        assert wrong_phone.status_code == no_such.status_code == 404
        assert wrong_phone.data["detail"] == no_such.data["detail"]

    @pytest.mark.parametrize(
        "typed", ["01799999999", "+8801799999999", "8801799999999", "017-9999-9999"]
    )
    def test_phone_nana_vabe_likhleo_cole(self, api, guest_order, typed):
        """মানুষ নানাভাবে নম্বর লেখেন — হুবহু মেলানো নিষ্ঠুর হতো।"""
        r = api.post(
            "/api/v1/orders/track/",
            {"order_number": guest_order.order_number, "phone": typed},
            format="json",
        )
        assert r.status_code == 200

    def test_choto_hater_number_o_cole(self, api, guest_order):
        r = api.post(
            "/api/v1/orders/track/",
            {"order_number": guest_order.order_number.lower(), "phone": "01799999999"},
            format="json",
        )
        assert r.status_code == 200


class TestGuestOrderGopon:
    def test_guest_order_onno_kretar_talikay_ase_na(self, api, customer, phone_product):
        api.post("/api/v1/orders/", payload(phone_product), format="json")
        client = auth_client(customer)
        r = client.get("/api/v1/orders/")
        assert r.data["count"] == 0

    def test_login_kora_kreta_guest_order_url_e_khulte_pare_na(
        self, api, customer, phone_product
    ):
        r = api.post("/api/v1/orders/", payload(phone_product), format="json")
        number = r.data["order_number"]

        client = auth_client(customer)
        assert client.get(f"/api/v1/orders/{number}/").status_code == 404

    def test_order_talika_dekhte_login_lage(self, api):
        assert api.get("/api/v1/orders/").status_code in (401, 403)


class TestServiceStore:
    def test_place_order_user_none_niye_cole(self, phone_product):
        order = place_order(
            None,
            [{"variant": phone_product.variants.first().id, "quantity": 1}],
            ADDRESS,
        )
        assert order.customer_id is None
        assert order.is_guest
