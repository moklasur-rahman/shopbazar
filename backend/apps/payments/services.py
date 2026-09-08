"""
পেমেন্টের ব্যবসায়িক নিয়ম — ভিউ থেকে আলাদা।

ভিউ শুধু HTTP সামলায়; কোন অবস্থায় অর্ডার "পরিশোধিত" হবে সেই সিদ্ধান্ত
এখানে। ফলে IPN, success কলব্যাক আর হাতে-চালানো যাচাই — তিনটাই একই
কোড ব্যবহার করে, আর তিন জায়গায় তিন রকম নিয়ম হওয়ার সুযোগ থাকে না।
"""

import logging

from django.db import transaction as db_transaction
from django.utils import timezone

from apps.orders.models import Order

from . import gateway
from .models import PaymentTransaction

logger = logging.getLogger(__name__)

#: গেটওয়ে এই দুইটার যেকোনো একটা বললে টাকা কাটা হয়েছে ধরা হয়।
#: VALIDATED মানে আগেই একবার যাচাই হয়েছিল — IPN আর success কলব্যাক
#: দুইটাই আসায় এটা খুব স্বাভাবিক, ব্যর্থতা নয়।
PAID_STATUSES = {"VALID", "VALIDATED"}


def next_tran_id(order):
    """
    এই অর্ডারের জন্য পরবর্তী লেনদেন আইডি।

    SSLCommerz একই `tran_id` দ্বিতীয়বার নেয় না। ক্রেতা প্রথমবার
    ব্যর্থ হয়ে আবার চেষ্টা করলে নতুন আইডি লাগে — তাই শেষে চেষ্টার
    ক্রমিক সংখ্যা জোড়া হয়:  SB-123456-1, SB-123456-2 …
    """
    attempt = order.transactions.count() + 1
    return f"{order.order_number}-{attempt}"


def start_payment(order, callback_base):
    """
    অর্ডারের জন্য নতুন একটা পেমেন্ট চেষ্টা শুরু করে।

    ফেরত দেয় (transaction, gateway_page_url)।
    """
    if order.payment_status == Order.PaymentStatus.PAID:
        raise gateway.GatewayError("এই অর্ডারের টাকা আগেই পরিশোধ হয়েছে।")

    txn = PaymentTransaction.objects.create(
        order=order,
        tran_id=next_tran_id(order),
        amount=order.grand_total,
    )

    try:
        url, raw = gateway.initiate(
            transaction=txn, order=order, callback_base=callback_base
        )
    except gateway.GatewayError:
        txn.status = PaymentTransaction.Status.FAILED
        txn.error_reason = "গেটওয়ে শুরু করা যায়নি"
        txn.save(update_fields=["status", "error_reason", "updated_at"])
        raise

    txn.gateway_response = raw
    txn.save(update_fields=["gateway_response", "updated_at"])
    return txn, url


@db_transaction.atomic
def settle(tran_id, val_id):
    """
    গেটওয়েকে জিজ্ঞাসা করে অর্ডারটা পরিশোধিত করা হবে কি না ঠিক করে।

    এটাই একমাত্র জায়গা যেখানে `payment_status = PAID` বসে।

    দুইবার ডাকা নিরাপদ — IPN আর success কলব্যাক প্রায় একসাথেই আসে,
    আর SSLCommerz IPN কয়েকবার পাঠাতেও পারে। আগেই সফল হয়ে থাকলে
    কিছু না করে সেটাই ফেরত দেওয়া হয়।
    """
    txn = (
        PaymentTransaction.objects.select_for_update()
        .select_related("order")
        .filter(tran_id=tran_id)
        .first()
    )
    if txn is None:
        logger.warning("অজানা tran_id-তে কলব্যাক: %s", tran_id)
        return None

    if txn.is_settled:
        return txn  # আগেই হয়ে গেছে

    data = gateway.validate(val_id)
    txn.val_id = val_id
    txn.gateway_response = data
    txn.card_type = str(data.get("card_type", ""))[:60]
    txn.bank_tran_id = str(data.get("bank_tran_id", ""))[:80]

    status = str(data.get("status", "")).upper()

    if status not in PAID_STATUSES:
        txn.status = PaymentTransaction.Status.FAILED
        txn.error_reason = f"গেটওয়ে বলেছে: {status or 'অজানা'}"
        txn.save()
        logger.info("পেমেন্ট ব্যর্থ %s: %s", tran_id, status)
        return txn

    # 🔒 টাকার অঙ্ক মেলানো। এটা ছাড়া কেউ ৳১ দিয়ে ৳২০,০০০ এর অর্ডার
    # "পরিশোধিত" করে ফেলতে পারত — গেটওয়ে শুধু বলে "টাকা কাটা হয়েছে",
    # কত টাকা সেটা মেলানোর দায়িত্ব আমাদের।
    if not txn.amount_matches(data.get("currency_amount") or data.get("amount")):
        txn.status = PaymentTransaction.Status.MISMATCH
        txn.error_reason = (
            f"অঙ্ক মেলেনি — আশা করা {txn.amount}, "
            f"পাওয়া {data.get('currency_amount') or data.get('amount')}"
        )
        txn.save()
        logger.error("⚠️ পেমেন্টের অঙ্ক মেলেনি %s: %s", tran_id, txn.error_reason)
        return txn

    if str(data.get("currency", "BDT")).upper() != txn.currency:
        txn.status = PaymentTransaction.Status.MISMATCH
        txn.error_reason = f"মুদ্রা মেলেনি — {data.get('currency')}"
        txn.save()
        logger.error("⚠️ পেমেন্টের মুদ্রা মেলেনি %s", tran_id)
        return txn

    txn.status = PaymentTransaction.Status.SUCCESS
    txn.paid_at = timezone.now()
    txn.error_reason = ""
    txn.save()

    order = txn.order
    order.payment_status = Order.PaymentStatus.PAID
    order.save(update_fields=["payment_status", "updated_at"])

    logger.info("পেমেন্ট সফল %s — অর্ডার %s", tran_id, order.order_number)
    return txn


def mark_failed(tran_id, status):
    """ক্রেতা বাতিল করেছেন বা গেটওয়ে ব্যর্থ বলেছে।"""
    txn = PaymentTransaction.objects.filter(tran_id=tran_id).first()
    if txn is None or txn.is_settled:
        return txn
    txn.status = status
    txn.save(update_fields=["status", "updated_at"])
    return txn
