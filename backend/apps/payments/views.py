"""
পেমেন্টের HTTP প্রান্ত।

চারটা পথ
--------
  POST /payments/start/              ক্রেতা — গেটওয়ের ঠিকানা চায়
  GET  /payments/status/<order>/     ক্রেতা — টাকা পৌঁছেছে কি না দেখে
  POST /payments/callback/<outcome>/ গেটওয়ে — ক্রেতার ব্রাউজার হয়ে
  POST /payments/ipn/                গেটওয়ে — সার্ভার-টু-সার্ভার

শেষ দুইটায় লগইন লাগে না, লাগতে পারেও না — SSLCommerz আমাদের
ব্যবহারকারীর টোকেন জানে না। তাই ওখানে কোনো তথ্য বিশ্বাস করা হয় না;
শুধু `val_id` নিয়ে সার্ভার-টু-সার্ভার যাচাই করা হয় (services.settle)।
"""

import logging

from django.conf import settings
from django.shortcuts import redirect
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status as http_status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.models import Order

from . import gateway, services
from .models import PaymentTransaction
from .serializers import PaymentTransactionSerializer, StartPaymentSerializer

logger = logging.getLogger(__name__)


def _frontend_url(path):
    base = settings.SSLCOMMERZ["FRONTEND_URL"].rstrip("/")
    return f"{base}{path}"


@extend_schema(
    tags=["payments"],
    summary="পেমেন্ট শুরু",
    description=(
        "অর্ডারের জন্য SSLCommerz-এ একটা সেশন খুলে গেটওয়ের পাতার ঠিকানা "
        "ফেরত দেয়। ফ্রন্টএন্ড ক্রেতাকে ওই ঠিকানায় পাঠিয়ে দেবে।\n\n"
        "একই অর্ডারে বারবার ডাকা যায় — আগের চেষ্টা ব্যর্থ হলে নতুন "
        "লেনদেন তৈরি হয়। তবে টাকা একবার পরিশোধ হয়ে গেলে ৪০০ আসে।"
    ),
    request=StartPaymentSerializer,
    responses={200: OpenApiResponse(description="{gateway_url, tran_id}")},
)
class StartPaymentView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = "checkout"

    def post(self, request):
        payload = StartPaymentSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        # সবসময় নিজের অর্ডার — URL/বডিতে অন্য কারো নম্বর দিলে ৪০৪
        order = Order.objects.filter(
            order_number=payload.validated_data["order_number"],
            customer=request.user,
        ).first()
        if order is None:
            return Response({"detail": "অর্ডারটি পাওয়া যায়নি।"}, status=404)

        if order.payment_method == "cod":
            return Response(
                {"detail": "ক্যাশ অন ডেলিভারিতে অনলাইনে টাকা দেওয়ার দরকার নেই।"},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        try:
            txn, url = services.start_payment(
                order, settings.SSLCOMMERZ["CALLBACK_BASE_URL"]
            )
        except gateway.GatewayError as exc:
            return Response({"detail": str(exc)}, status=http_status.HTTP_502_BAD_GATEWAY)

        return Response({"gateway_url": url, "tran_id": txn.tran_id})


@extend_schema(
    tags=["payments"],
    summary="পেমেন্টের অবস্থা",
    responses={200: PaymentTransactionSerializer(many=True)},
)
class PaymentStatusView(APIView):
    """
    গেটওয়ে থেকে ফেরার পর ফ্রন্টএন্ড এটাই জিজ্ঞাসা করে।

    কলব্যাকে যা লেখা থাকে তা দেখানো হয় না — কারণ ওটা ক্রেতার ব্রাউজার
    হয়ে আসা, বদলে ফেলা যায়। ডেটাবেসে যা সত্যি সেটাই দেখানো হয়।
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, order_number):
        order = Order.objects.filter(
            order_number=order_number, customer=request.user
        ).first()
        if order is None:
            return Response({"detail": "অর্ডারটি পাওয়া যায়নি।"}, status=404)

        return Response({
            "order_number": order.order_number,
            "payment_method": order.payment_method,
            "payment_status": order.payment_status,
            "grand_total": order.grand_total,
            "transactions": PaymentTransactionSerializer(
                order.transactions.all(), many=True
            ).data,
        })


@method_decorator(csrf_exempt, name="dispatch")
@extend_schema(exclude=True)
class PaymentCallbackView(APIView):
    """
    গেটওয়ে ক্রেতাকে এখানে ফেরত পাঠায় (POST, ব্রাউজার হয়ে)।

    এখানকার POST ডেটার একটা কথাও বিশ্বাস করা হয় না — শুধু `tran_id` আর
    `val_id` নেওয়া হয়, বাকিটা services.settle() সার্ভার-টু-সার্ভার
    যাচাই করে ঠিক করে।

    শেষে ক্রেতাকে ফ্রন্টএন্ডের পাতায় রিডাইরেক্ট করা হয়।
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, outcome):
        return self._handle(request, outcome)

    def get(self, request, outcome):
        # কিছু ক্ষেত্রে গেটওয়ে GET-এও ফেরত পাঠায়
        return self._handle(request, outcome)

    def _handle(self, request, outcome):
        data = request.data if request.data else request.query_params
        tran_id = str(data.get("tran_id", "")).strip()
        order_number = tran_id.rsplit("-", 1)[0] if tran_id else ""

        if outcome == "success":
            val_id = str(data.get("val_id", "")).strip()
            if tran_id and val_id:
                try:
                    txn = services.settle(tran_id, val_id)
                except gateway.GatewayError:
                    logger.exception("কলব্যাকে যাচাই ব্যর্থ: %s", tran_id)
                    txn = None
                if txn and txn.is_settled:
                    return redirect(_frontend_url(f"/payment/success/{order_number}"))
            return redirect(_frontend_url(f"/payment/pending/{order_number}"))

        if outcome == "cancel":
            services.mark_failed(tran_id, PaymentTransaction.Status.CANCELLED)
            return redirect(_frontend_url(f"/payment/cancelled/{order_number}"))

        services.mark_failed(tran_id, PaymentTransaction.Status.FAILED)
        return redirect(_frontend_url(f"/payment/failed/{order_number}"))


@method_decorator(csrf_exempt, name="dispatch")
@extend_schema(exclude=True)
class PaymentIpnView(APIView):
    """
    IPN — সার্ভার-টু-সার্ভার বিজ্ঞপ্তি। এটাই বেশি নির্ভরযোগ্য।

    ক্রেতা টাকা দিয়ে ব্রাউজার বন্ধ করে ফেললে success কলব্যাক আর আসে
    না, কিন্তু IPN আসে। তাই অর্ডার পরিশোধিত হওয়া এটার উপরই ভরসা করে।

    SSLCommerz একই বিজ্ঞপ্তি কয়েকবার পাঠাতে পারে — settle() বারবার
    ডাকলেও নিরাপদ।
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        tran_id = str(request.data.get("tran_id", "")).strip()
        val_id = str(request.data.get("val_id", "")).strip()

        if not tran_id or not val_id:
            return Response({"detail": "tran_id ও val_id দুটোই লাগবে।"}, status=400)

        try:
            txn = services.settle(tran_id, val_id)
        except gateway.GatewayError:
            logger.exception("IPN যাচাই ব্যর্থ: %s", tran_id)
            # ৫০০ দিলে SSLCommerz আবার পাঠাবে — সেটাই চাই
            return Response({"detail": "যাচাই করা যায়নি"}, status=500)

        if txn is None:
            return Response({"detail": "অজানা লেনদেন"}, status=404)
        return Response({"status": txn.status})
