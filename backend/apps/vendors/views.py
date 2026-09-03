from django.db.models import Count, Q
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny

from apps.catalog.filters import ProductFilter
from apps.catalog.serializers import ProductListSerializer
from apps.catalog.views import live_products

from .models import Vendor
from .serializers import VendorSerializer


class VendorViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """অনুমোদিত দোকানগুলোই কেবল সাইটে দেখা যায়।"""

    serializer_class = VendorSerializer
    permission_classes = [AllowAny]
    lookup_field = "slug"
    search_fields = ["shop_name", "district"]
    ordering_fields = ["rating_avg", "created_at"]
    ordering = ["-rating_avg"]

    def get_queryset(self):
        return Vendor.objects.filter(status=Vendor.Status.APPROVED).annotate(
            live_product_count=Count("products", filter=Q(products__status="live"))
        )

    @action(detail=True, methods=["get"], url_path="products")
    def products(self, request, slug=None):
        vendor = self.get_object()
        queryset = live_products().filter(vendor=vendor)

        # ক্যাটালগের ফিল্টার ও সর্টিং এখানেও কাজ করে
        queryset = ProductFilter(request.query_params, queryset=queryset).qs
        ordering = request.query_params.get("ordering")
        if ordering in {"price", "-price", "-sold_count", "-rating_avg", "-created_at", "created_at"}:
            queryset = queryset.order_by(ordering)

        page = self.paginate_queryset(queryset)
        serializer = ProductListSerializer(page, many=True, context={"request": request})
        return self.get_paginated_response(serializer.data)
