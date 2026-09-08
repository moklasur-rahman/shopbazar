"""
SSLCommerz-এর সাথে কথা বলার একমাত্র জায়গা।

দুইটা কল
--------
১. **initiate** — অর্ডারের তথ্য পাঠিয়ে একটা `GatewayPageURL` আনা।
   ক্রেতাকে ওই ঠিকানায় পাঠালে বিকাশ/নগদ/কার্ড বেছে নেওয়ার পাতা আসে।

২. **validate** — টাকা সত্যিই কাটা হয়েছে কি না, সেটা **আমাদের সার্ভার
   থেকে সরাসরি** SSLCommerz-কে জিজ্ঞাসা করা।

⚠️ কেন দ্বিতীয় কলটা বাদ দেওয়া যাবে না
------------------------------------
পেমেন্ট শেষে SSLCommerz ক্রেতার ব্রাউজার দিয়ে আমাদের success_url-এ
একটা POST পাঠায়। ওই POST-এ `status=VALID` আর টাকার অঙ্ক থাকে।

কিন্তু ওটা আসে **ক্রেতার ব্রাউজার হয়ে**। যে কেউ নিজে হাতে একটা POST
বানিয়ে "status=VALID, amount=99999" পাঠিয়ে দিতে পারেন — এক টাকাও না
দিয়ে অর্ডার "পরিশোধিত" বানিয়ে ফেলা যেত।

তাই কলব্যাকের কোনো কথা বিশ্বাস করা হয় না। সেখান থেকে শুধু `val_id`
নেওয়া হয়, আর সেটা দিয়ে সার্ভার-টু-সার্ভার জিজ্ঞাসা করে আসল অবস্থা
জানা হয়। এই উত্তরটা ক্রেতার হাত দিয়ে আসে না, তাই বদলানো যায় না।
"""

import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

#: গেটওয়ে ধীর হলে অনির্দিষ্টকাল ঝুলে থাকা চলবে না — gunicorn ওয়ার্কার
#: আটকে গেলে পুরো সাইট বসে যায়
TIMEOUT = 20

SANDBOX = "https://sandbox.sslcommerz.com"
LIVE = "https://securepay.sslcommerz.com"


class GatewayError(Exception):
    """গেটওয়ের সাথে কথা বলা যায়নি, বা সে বোধগম্য উত্তর দেয়নি।"""


class GatewayNotConfigured(GatewayError):
    """
    মার্চেন্ট অ্যাকাউন্টের কি বসানো হয়নি।

    আলাদা ব্যতিক্রম কেন: এটা "গেটওয়ে বন্ধ" নয়, "আমরা এখনো চালু করিনি"।
    ক্রেতাকে এই দুইটার আলাদা বার্তা দেখানো দরকার — আর তার সামনে
    কখনোই "STORE_ID দেওয়া নেই" লেখা যাবে না, ওটা ডেভেলপারের কথা।
    """


def is_configured():
    """কি বসানো আছে কি না — অনলাইন পেমেন্ট দেখানো যাবে কি না ঠিক করতে।"""
    cfg = settings.SSLCOMMERZ
    return bool(cfg["STORE_ID"] and cfg["STORE_PASSWORD"])


def _config():
    cfg = settings.SSLCOMMERZ
    if not is_configured():
        raise GatewayNotConfigured(
            "SSLCommerz-এর STORE_ID / STORE_PASSWORD দেওয়া নেই। "
            ".env ফাইলে বসিয়ে সার্ভার রিস্টার্ট করুন।"
        )
    return cfg


def _base_url():
    return SANDBOX if _config()["SANDBOX"] else LIVE


def initiate(*, transaction, order, callback_base):
    """
    পেমেন্ট শুরু করে গেটওয়ের পাতার ঠিকানা ফেরত দেয়।

    `callback_base` হলো আমাদের সাইটের বাইরের ঠিকানা (যেমন
    https://shopbazar.com) — SSLCommerz ওখানেই ফিরে আসবে। localhost
    দিলে গেটওয়ে পৌঁছাতে পারে না, তাই লোকাল পরীক্ষায় ngrok-জাতীয়
    টানেল লাগে।
    """
    cfg = _config()
    address = order.shipping_address or {}

    payload = {
        "store_id": cfg["STORE_ID"],
        "store_passwd": cfg["STORE_PASSWORD"],
        "total_amount": str(transaction.amount),
        "currency": transaction.currency,
        "tran_id": transaction.tran_id,

        # ক্রেতা পেমেন্ট শেষে/বাতিল করলে যেখানে ফিরবেন
        "success_url": f"{callback_base}/api/v1/payments/callback/success/",
        "fail_url": f"{callback_base}/api/v1/payments/callback/fail/",
        "cancel_url": f"{callback_base}/api/v1/payments/callback/cancel/",
        # IPN — সার্ভার-টু-সার্ভার। ক্রেতা ব্রাউজার বন্ধ করে দিলেও
        # এটা আসে, তাই এটাই বেশি নির্ভরযোগ্য
        "ipn_url": f"{callback_base}/api/v1/payments/ipn/",

        "shipping_method": "Courier",
        "product_name": f"শপবাজার অর্ডার {order.order_number}",
        "product_category": "Marketplace",
        "product_profile": "general",

        "cus_name": address.get("receiver_name") or order.customer.full_name,
        "cus_email": order.customer.email or "noreply@shopbazar.com",
        "cus_phone": address.get("phone") or order.customer.phone,
        "cus_add1": address.get("address_line", ""),
        "cus_city": address.get("district", ""),
        "cus_country": "Bangladesh",

        "ship_name": address.get("receiver_name", ""),
        "ship_add1": address.get("address_line", ""),
        "ship_city": address.get("district", ""),
        "ship_country": "Bangladesh",
        "num_of_item": sum(vo.items.count() for vo in order.vendor_orders.all()),
    }

    try:
        response = requests.post(
            f"{_base_url()}/gwprocess/v4/api.php", data=payload, timeout=TIMEOUT
        )
        response.raise_for_status()
        data = response.json()
    except requests.RequestException as exc:
        logger.error("SSLCommerz initiate ব্যর্থ: %s", exc)
        raise GatewayError("পেমেন্ট গেটওয়েতে পৌঁছানো যায়নি। আবার চেষ্টা করুন।") from exc
    except ValueError as exc:
        logger.error("SSLCommerz initiate-এ অবোধ্য উত্তর")
        raise GatewayError("পেমেন্ট গেটওয়ে অপ্রত্যাশিত উত্তর দিয়েছে।") from exc

    if data.get("status") != "SUCCESS" or not data.get("GatewayPageURL"):
        reason = data.get("failedreason") or data.get("status") or "অজানা কারণ"
        logger.error("SSLCommerz initiate প্রত্যাখ্যান: %s", reason)
        raise GatewayError(f"পেমেন্ট শুরু করা গেল না: {reason}")

    return data["GatewayPageURL"], data


def validate(val_id):
    """
    সার্ভার-টু-সার্ভার যাচাই — এটাই একমাত্র বিশ্বাসযোগ্য উত্তর।

    ফেরত দেয় গেটওয়ের কাঁচা ডিকশনারি। `status` হতে পারে:
      VALID           — টাকা কাটা হয়েছে
      VALIDATED       — কাটা হয়েছে, আগেই একবার যাচাই হয়েছিল
      INVALID_TRANSACTION / অন্য কিছু — হয়নি
    """
    cfg = _config()
    try:
        response = requests.get(
            f"{_base_url()}/validator/api/validationserverAPI.php",
            params={
                "val_id": val_id,
                "store_id": cfg["STORE_ID"],
                "store_passwd": cfg["STORE_PASSWORD"],
                "format": "json",
            },
            timeout=TIMEOUT,
        )
        response.raise_for_status()
        return response.json()
    except requests.RequestException as exc:
        logger.error("SSLCommerz validate ব্যর্থ (val_id=%s): %s", val_id, exc)
        raise GatewayError("পেমেন্ট যাচাই করা গেল না।") from exc
    except ValueError as exc:
        raise GatewayError("পেমেন্ট যাচাইয়ে অবোধ্য উত্তর।") from exc
