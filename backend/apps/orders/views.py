from django.db.models import Prefetch
from drf_spectacular.utils import OpenApiResponse, extend_schema, inline_serializer
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.promotions.models import Coupon

from .models import Order, OrderItem, VendorOrder
from .serializers import (
    OrderCreateSerializer, OrderSerializer, QuoteInputSerializer, VendorOrderSerializer,
)
from .services import calculate, cancel_vendor_order, place_order


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
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "order_number"
    lookup_value_regex = "[^/]+"

    def get_throttles(self):
        if self.action == "create":
            self.throttle_scope = "checkout"
        return super().get_throttles()

    def get_queryset(self):
        # সবসময় নিজের অর্ডার — URL-এ অন্য কারো নম্বর দিলেও কিছু পাওয়া যাবে না
        return (
            Order.objects.filter(customer=self.request.user)
            .prefetch_related(
                Prefetch(
                    "vendor_orders",
                    queryset=VendorOrder.objects.select_related("vendor").prefetch_related(
                        Prefetch("items", queryset=OrderItem.objects.all())
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

    def create(self, request, *args, **kwargs):
        payload = OrderCreateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data

        order = place_order(
            user=request.user,
            items=data["items"],
            address=dict(data["shipping_address"]),
            payment_method=data["payment_method"],
            coupon=find_coupon(data.get("coupon_code")),
        )

        return Response(
            OrderSerializer(order, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
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
