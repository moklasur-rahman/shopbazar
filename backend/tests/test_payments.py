"""
পেমেন্টের টেস্ট — মূল প্রশ্ন একটাই: টাকা না দিয়ে অর্ডার "পরিশোধিত"
করা যায় কি না।

গেটওয়ের সাথে আসল HTTP কল করা হয় না — `gateway.validate` কে নকল
(mock) করা হয়। কারণ টেস্ট ইন্টারনেটের উপর নির্ভর করলে SSLCommerz
বন্ধ থাকলেই CI লাল হতো, অথচ আমাদের কোডে কোনো দোষ নেই।

যা যাচাই হয়:
  · গেটওয়ে VALID না বললে PAID হয় না
  · অঙ্ক না মিললে PAID হয় না (সবচেয়ে গুরুত্বপূর্ণ)
  · একই বিজ্ঞপ্তি দুইবার এলে দুইবার কিছু হয় না
  · অর্ডার তৈরির সময় কখনোই PAID হয় না
  · অন্যের অর্ডারের পেমেন্ট শুরু করা যায় না
"""

from decimal import Decimal
from unittest.mock import patch

import pytest

from apps.orders.models import Order
from apps.orders.services import place_order
from apps.payments import services
from apps.payments.gateway import GatewayError
from apps.payments.models import PaymentTransaction
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db


def items_for(*pairs):
    return [
        {"variant": product.variants.first().id, "quantity": qty}
        for product, qty in pairs
    ]


@pytest.fixture
def bkash_order(customer, phone_product, address):
    return place_order(
        customer, items_for((phone_product, 1)), address, payment_method="bkash"
    )


@pytest.fixture
def txn(bkash_order):
    return PaymentTransaction.objects.create(
        order=bkash_order,
        tran_id=services.next_tran_id(bkash_order),
        amount=bkash_order.grand_total,
    )


def gateway_says(status, amount=None, currency="BDT"):
    """SSLCommerz-এর যাচাই-উত্তরের নকল।"""
    return {
        "status": status,
        "currency_amount": str(amount) if amount is not None else None,
        "currency": currency,
        "card_type": "BKASH-BKash",
        "bank_tran_id": "BK123456",
        "val_id": "VAL-TEST-1",
    }


class TestOrderTairirShomoy:
    def test_online_payment_e_o_order_pending_thake(self, bkash_order):
        """
        সবচেয়ে জরুরি টেস্ট।

        আগে কোডে লেখা ছিল "cod না হলে PAID" — অর্থাৎ শুধু বিকাশ বেছে
        নিলেই টাকা না দিয়ে অর্ডার পরিশোধিত হয়ে যেত।
        """
        assert bkash_order.payment_method == "bkash"
        assert bkash_order.payment_status == Order.PaymentStatus.PENDING

    def test_cod_o_pending(self, customer, phone_product, address):
        order = place_order(customer, items_for((phone_product, 1)), address)
        assert order.payment_status == Order.PaymentStatus.PENDING


class TestSettle:
    def test_gateway_valid_bolle_paid_hoy(self, txn):
        with patch.object(
            services.gateway, "validate",
            return_value=gateway_says("VALID", txn.amount),
        ):
            result = services.settle(txn.tran_id, "VAL-1")

        assert result.status == PaymentTransaction.Status.SUCCESS
        assert result.paid_at is not None
        txn.order.refresh_from_db()
        assert txn.order.payment_status == Order.PaymentStatus.PAID

    def test_gateway_invalid_bolle_paid_hoy_na(self, txn):
        with patch.object(
            services.gateway, "validate",
            return_value=gateway_says("INVALID_TRANSACTION", txn.amount),
        ):
            result = services.settle(txn.tran_id, "VAL-1")

        assert result.status == PaymentTransaction.Status.FAILED
        txn.order.refresh_from_db()
        assert txn.order.payment_status == Order.PaymentStatus.PENDING

    def test_kom_taka_dile_paid_hoy_na(self, txn):
        """
        কেউ ৳১ দিয়ে ২০ হাজার টাকার অর্ডার পরিশোধিত করার চেষ্টা করলে।

        গেটওয়ে শুধু বলে "টাকা কাটা হয়েছে" — কত টাকা সেটা মেলানোর
        দায়িত্ব আমাদের। এই চেকটা না থাকলে পুরো দোকান লুট হয়ে যেত।
        """
        with patch.object(
            services.gateway, "validate",
            return_value=gateway_says("VALID", Decimal("1.00")),
        ):
            result = services.settle(txn.tran_id, "VAL-1")

        assert result.status == PaymentTransaction.Status.MISMATCH
        txn.order.refresh_from_db()
        assert txn.order.payment_status == Order.PaymentStatus.PENDING

    def test_onno_mudra_dile_paid_hoy_na(self, txn):
        with patch.object(
            services.gateway, "validate",
            return_value=gateway_says("VALID", txn.amount, currency="USD"),
        ):
            result = services.settle(txn.tran_id, "VAL-1")

        assert result.status == PaymentTransaction.Status.MISMATCH
        txn.order.refresh_from_db()
        assert txn.order.payment_status == Order.PaymentStatus.PENDING

    def test_duibar_ipn_ele_ekbar_i_settle(self, txn):
        """SSLCommerz একই IPN কয়েকবার পাঠায় — দ্বিতীয়বার যেন কিছু না হয়।"""
        with patch.object(
            services.gateway, "validate",
            return_value=gateway_says("VALID", txn.amount),
        ) as mocked:
            first = services.settle(txn.tran_id, "VAL-1")
            second = services.settle(txn.tran_id, "VAL-1")

        assert first.pk == second.pk
        assert second.status == PaymentTransaction.Status.SUCCESS
        # দ্বিতীয়বার গেটওয়েকে আর জিজ্ঞাসাই করা হয়নি
        assert mocked.call_count == 1
        assert PaymentTransaction.objects.filter(order=txn.order).count() == 1

    def test_ojana_tran_id_e_kichu_hoy_na(self, txn):
        assert services.settle("SB-000000-9", "VAL-1") is None


class TestTranId:
    def test_protiti_chestay_notun_id(self, bkash_order):
        """SSLCommerz একই tran_id দ্বিতীয়বার নেয় না।"""
        first = services.next_tran_id(bkash_order)
        PaymentTransaction.objects.create(
            order=bkash_order, tran_id=first, amount=bkash_order.grand_total
        )
        assert services.next_tran_id(bkash_order) != first


class TestApiNirapotta:
    def test_login_chara_payment_shuru_kora_jay_na(self, api, bkash_order):
        r = api.post(
            "/api/v1/payments/start/",
            {"order_number": bkash_order.order_number}, format="json",
        )
        assert r.status_code in (401, 403)

    def test_onner_order_er_payment_shuru_kora_jay_na(self, staff, bkash_order):
        """অন্য কারো অর্ডার নম্বর বসিয়ে দিলে ৪০৪ — অস্তিত্বই স্বীকার করা হয় না।"""
        client = auth_client(staff)
        r = client.post(
            "/api/v1/payments/start/",
            {"order_number": bkash_order.order_number}, format="json",
        )
        assert r.status_code == 404

    def test_cod_order_e_online_payment_atkay(self, customer, phone_product, address):
        order = place_order(customer, items_for((phone_product, 1)), address)
        client = auth_client(customer)
        r = client.post(
            "/api/v1/payments/start/",
            {"order_number": order.order_number}, format="json",
        )
        assert r.status_code == 400

    def test_gateway_bhenge_gele_502(self, customer, bkash_order):
        client = auth_client(customer)
        with patch.object(
            services.gateway, "initiate", side_effect=GatewayError("গেটওয়ে বন্ধ")
        ):
            r = client.post(
                "/api/v1/payments/start/",
                {"order_number": bkash_order.order_number}, format="json",
            )
        assert r.status_code == 502

    def test_status_e_onner_order_dekha_jay_na(self, staff, bkash_order):
        client = auth_client(staff)
        r = client.get(f"/api/v1/payments/status/{bkash_order.order_number}/")
        assert r.status_code == 404

    def test_ipn_e_tran_id_val_id_chara_400(self, api):
        r = api.post("/api/v1/payments/ipn/", {}, format="json")
        assert r.status_code == 400
