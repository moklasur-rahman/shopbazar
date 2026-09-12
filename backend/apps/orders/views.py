from django.db.models import Prefetch
from drf_spectacular.utils import (
    OpenApiParameter, OpenApiResponse, extend_schema, inline_serializer,
)
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.promotions.models import Coupon

from .models import Order, OrderItem, VendorOrder
from .serializers import (
    OrderCreateSerializer, OrderSerializer, QuoteInputSerializer, TrackOrderSerializer,
    VendorOrderSerializer,
)
from .services import calculate, cancel_vendor_order, place_order


def normalize_phone(value):
    """
    তুলনার আগে ফোন নম্বর এক চেহারায় আনা।

    মানুষ নানাভাবে লেখেন — 01711111111, 017-1111-1111, +8801711111111।
    হুবহু মিলিয়ে দেখলে নিজের অর্ডারই খুঁজে পেতেন না।
    """
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())
    if digits.startswith("880"):
        digits = digits[3:]
    if not digits.startswith("0"):
        digits = "0" + digits
    return digits


def find_coupon(code):
    if not code:
        return None
    return Coupon.objects.filter(code__iexact=str(code).strip()).first()


@extend_schema(
    tags=["checkout"],
    summary="চেকআউটের হিসাব",
    description=(
        "কার্ট, জেলা আর কুপন পাঠালে সার্ভার চূড়ান্ত টাকার হিসাব ফেরত দেয় — "
        "প্রতি দোকানের আলাদা পার্সেলসহ। অর্ডার করার আগে এটাই সত্য।"
    ),
    request=QuoteInputSerializer,
    responses={200: OpenApiResponse(description="items_total, shipping_total, discount_total, grand_total, parcels")},
)
class QuoteView(APIView):
    """
    POST /checkout/quote/

    কার্ট + জেলা + কুপন পাঠালে সার্ভার পুরো হিসাব ফেরত দেয়।
    ফ্রন্টএন্ড নিজেও হিসাব করে দ্রুত দেখানোর জন্য, কিন্তু চূড়ান্ত অঙ্ক এটাই।
    """

    permission_classes = [AllowAny]
    throttle_scope = "checkout"

    def post(self, request):
        payload = QuoteInputSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data

        summary = calculate(
            data["items"], data.get("district", ""), find_coupon(data.get("coupon_code"))
        )

        return Response({
            "items_total": summary["items_total"],
            "shipping_total": summary["shipping_total"],
            "discount_total": summary["discount_total"],
            "grand_total": summary["grand_total"],
            "coupon_error": summary["coupon_error"],
            "parcels": [
                {
                    "vendor": g["vendor"].shop_name,
                    "items_total": g["items_total"],
                    "discount": g["discount"],
                    "shipping": g["shipping"],
                    "payable_total": g["payable_total"],
                }
                for g in summary["groups"]
            ],
        })


class OrderViewSet(mixins.CreateModelMixin, mixins.ListModelMixin,
                   mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """
    ক্রেতার অর্ডার।

    অর্ডার **করতে** লগইন লাগে না — ক্যাশ অন ডেলিভারিতে (নিচে
    `get_permissions` দেখুন)। কিন্তু অর্ডারের তালিকা দেখতে লাগে,
    কারণ তালিকা মানেই "আমার সব অর্ডার", আর সেটা অ্যাকাউন্ট ছাড়া
    বোঝানোর উপায় নেই। গেস্ট নিজের অর্ডার দেখেন নম্বর + ফোন দিয়ে
    (`/orders/track/`)।
    """

    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "order_number"
    lookup_value_regex = "[^/]+"

    def get_permissions(self):
        """
        অর্ডার তৈরিতে লগইন বাধ্যতামূলক নয়।

        তবে এটা "যা খুশি" নয় — `create()`-এ দেখা হয় পেমেন্ট পদ্ধতি
        cod কি না। অনলাইন পেমেন্টে লগইন লাগেই, কারণ টাকা ফেরত,
        লেনদেনের ইতিহাস আর বিরোধ মেটানো — সবকিছুর জন্য অ্যাকাউন্ট দরকার।
        """
        if self.action == "create":
            return [AllowAny()]
        return super().get_permissions()

    def get_throttles(self):
        if self.action == "create":
            self.throttle_scope = "checkout"
        return super().get_throttles()

    queryset = Order.objects.none()  # স্কিমা জেনারেটরের জন্য

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False) or not self.request.user.is_authenticated:
            return Order.objects.none()

        # সবসময় নিজের অর্ডার — URL-এ অন্য কারো নম্বর দিলেও কিছু পাওয়া যাবে না
        return (
            Order.objects.filter(customer=self.request.user)
            .prefetch_related(
                Prefetch(
                    "vendor_orders",
                    queryset=VendorOrder.objects.select_related("vendor").prefetch_related(
                        # `review` সহ — OrderItem.can_review `hasattr(self, "review")`
                    # দেখে, তাই প্রিফেচ না করলে প্রতিটি আইটেমের জন্য একটা
                    # করে কোয়েরি যেত (৫টি আইটেমে ৫টি বাড়তি কোয়েরি)
                    Prefetch(
                        "items",
                        queryset=OrderItem.objects.select_related("review"),
                    )
                    ),
                )
            )
        )

    def get_queryset_filtered(self, queryset):
        """?status= দিলে ওই অবস্থার পার্সেল আছে এমন অর্ডারগুলো।"""
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(vendor_orders__status=status_filter).distinct()
        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset_filtered(self.get_queryset())
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @extend_schema(
        summary="অর্ডার করা",
        description=(
            "`Idempotency-Key` হেডার পাঠানো **জোরালোভাবে সুপারিশ করা হয়** — "
            "একই কি দিয়ে দ্বিতীয়বার অনুরোধ এলে নতুন অর্ডার না বানিয়ে আগের "
            "অর্ডারটাই ২০০ স্ট্যাটাসে ফেরত আসে। নতুন অর্ডার হলে ২০১।"
        ),
        request=OrderCreateSerializer,
        parameters=[
            OpenApiParameter(
                name="Idempotency-Key", location=OpenApiParameter.HEADER, required=False,
                type=str, description="প্রতি চেকআউটে একটি এলোমেলো মান (যেমন UUID)।",
            )
        ],
        responses={201: OrderSerializer, 200: OrderSerializer},
    )
    def create(self, request, *args, **kwargs):
        payload = OrderCreateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data

        # হেডার আগে — সেটাই প্রচলিত নিয়ম; না থাকলে বডির মান
        key = (request.headers.get("Idempotency-Key") or data.get("idempotency_key") or "").strip()

        logged_in = request.user.is_authenticated

        # 🔒 লগইন ছাড়া শুধু ক্যাশ অন ডেলিভারি।
        #
        # অনলাইন পেমেন্টে অ্যাকাউন্ট লাগেই — টাকা ফেরত দিতে হলে কাকে
        # দেব, লেনদেনের ইতিহাস কে দেখবে, বিরোধ হলে কার সাথে কথা বলব।
        # ফোন নম্বর দিয়ে সেসব সামলানো যায় না।
        if not logged_in and data["payment_method"] != "cod":
            return Response(
                {
                    "detail": "অনলাইনে টাকা দিতে হলে আগে লগইন করুন। "
                              "ক্যাশ অন ডেলিভারিতে লগইন ছাড়াই অর্ডার করা যায়।",
                    "code": "login_required_for_online_payment",
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        order = place_order(
            user=request.user if logged_in else None,
            items=data["items"],
            address=dict(data["shipping_address"]),
            payment_method=data["payment_method"],
            coupon=find_coupon(data.get("coupon_code")),
            idempotency_key=key[:64],
        )

        return Response(
            OrderSerializer(order, context={"request": request}).data,
            status=(
                status.HTTP_200_OK if getattr(order, "is_replay", False)
                else status.HTTP_201_CREATED
            ),
        )


@extend_schema(
    tags=["orders"],
    summary="পার্সেল বাতিল",
    description=(
        "ক্রেতা একটা দোকানের পার্সেল বাতিল করছেন। প্যাক হয়ে যাওয়ার পর আর "
        "বাতিল করা যায় না। বাতিল হলে স্টক ফেরত যায়।"
    ),
    request=inline_serializer(
        name="CancelParcelRequest",
        fields={"reason": serializers.CharField(required=False)},
    ),
    responses={200: VendorOrderSerializer, 400: OpenApiResponse(description="প্যাক হয়ে গেছে")},
)
class CancelVendorOrderView(APIView):
    """POST /orders/vendor-orders/<id>/cancel/ — ক্রেতা একটা পার্সেল বাতিল করছেন।"""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        vendor_order = (
            VendorOrder.objects.select_related("order", "vendor")
            .filter(pk=pk, order__customer=request.user)
            .first()
        )
        if vendor_order is None:
            return Response(
                {"detail": "অর্ডারটি পাওয়া যায়নি।"}, status=status.HTTP_404_NOT_FOUND
            )

        reason = str(request.data.get("reason", "ক্রেতা বাতিল করেছেন"))
        cancel_vendor_order(vendor_order, reason)

        return Response(VendorOrderSerializer(vendor_order, context={"request": request}).data)


@extend_schema(
    tags=["orders"],
    summary="অর্ডার খোঁজা (লগইন ছাড়া)",
    description=(
        "অ্যাকাউন্ট ছাড়া অর্ডার করা ক্রেতা এখান থেকে নিজের অর্ডার দেখেন — "
        "অর্ডার নম্বর ও যে মোবাইল নম্বর দিয়ে অর্ডার করেছিলেন, দুটোই লাগে।"
    ),
    request=TrackOrderSerializer,
    responses={200: OrderSerializer, 404: OpenApiResponse(description="মেলেনি")},
)
class TrackOrderView(APIView):
    """
    POST /orders/track/  { order_number, phone }

    ⚠️ কেন GET নয়: GET হলে অর্ডার নম্বর আর ফোন ব্রাউজারের ইতিহাসে,
    সার্ভারের অ্যাক্সেস লগে আর রেফারার হেডারে থেকে যেত।

    ⚠️ কেন throttle: নম্বর অনুমান করে বারবার চেষ্টা করা ঠেকাতে।
    সফল-ব্যর্থ দুই ক্ষেত্রেই একই ৪০৪ বার্তা — নইলে "নম্বর ঠিক কিন্তু
    ফোন ভুল" আর "নম্বরই নেই" আলাদা করে বোঝা যেত, আর সেটা দিয়ে কোন
    অর্ডার নম্বরগুলো আসল তা বের করা যেত।
    """

    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        payload = TrackOrderSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        number = payload.validated_data["order_number"].strip().upper()
        phone = normalize_phone(payload.validated_data["phone"])

        order = (
            Order.objects.filter(order_number=number)
            .prefetch_related(
                Prefetch(
                    "vendor_orders",
                    queryset=VendorOrder.objects.select_related("vendor").prefetch_related(
                        # `review` সহ — OrderItem.can_review `hasattr(self, "review")`
                    # দেখে, তাই প্রিফেচ না করলে প্রতিটি আইটেমের জন্য একটা
                    # করে কোয়েরি যেত (৫টি আইটেমে ৫টি বাড়তি কোয়েরি)
                    Prefetch(
                        "items",
                        queryset=OrderItem.objects.select_related("review"),
                    )
                    ),
                )
            )
            .first()
        )

        not_found = Response(
            {"detail": "এই অর্ডার নম্বর ও মোবাইল নম্বরে কোনো অর্ডার পাওয়া যায়নি।"},
            status=status.HTTP_404_NOT_FOUND,
        )
        if order is None:
            return not_found
        if normalize_phone(order.contact_phone) != phone:
            return not_found

        return Response(OrderSerializer(order, context={"request": request}).data)
