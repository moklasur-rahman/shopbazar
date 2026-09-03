

from django.db.models import F, Prefetch
from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .filters import ProductFilter
from .models import Banner, Category, Product, ProductImage
from .serializers import (
    BannerSerializer, CategorySerializer, ProductListSerializer,
    ProductSerializer, ReviewSerializer,
)


def live_products():
    """
    সাইটে দেখানোর যোগ্য পণ্য: নিজে সচল, আর দোকানও অনুমোদিত।

    দ্বিতীয় শর্তটা জরুরি — কোনো দোকান স্থগিত হলে তার সব পণ্য
    সাথে সাথে সাইট থেকে হারিয়ে যাওয়া উচিত।
    """
    return (
        Product.objects.filter(status=Product.Status.LIVE, vendor__status="approved")
        .select_related("vendor", "category", "brand")
        .prefetch_related(
            "variants",
            Prefetch("images", queryset=ProductImage.objects.order_by("sort_order", "id")),
        )
    )


class CategoryViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = Category.objects.filter(is_active=True, parent__isnull=True).prefetch_related(
        "children"
    )
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]
    pagination_class = None


class ProductViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [AllowAny]
    lookup_field = "slug"
    filterset_class = ProductFilter
    search_fields = ["title", "description", "vendor__shop_name", "category__name"]
    ordering_fields = ["created_at", "sold_count", "price", "rating_avg"]
    ordering = ["-created_at"]

    def get_queryset(self):
        return live_products()

    def get_serializer_class(self):
        return ProductSerializer if self.action == "retrieve" else ProductListSerializer

    @action(detail=True, methods=["get"], url_path="reviews")
    def reviews(self, request, slug=None):
        product = self.get_object()
        queryset = product.reviews.select_related("author").prefetch_related("photos")
        page = self.paginate_queryset(queryset)
        serializer = ReviewSerializer(page, many=True, context={"request": request})
        return self.get_paginated_response(serializer.data)


class BannerListView(ListAPIView):
    queryset = Banner.objects.filter(is_active=True)
    serializer_class = BannerSerializer
    permission_classes = [AllowAny]
    pagination_class = None


@extend_schema(
    tags=["catalog"],
    summary="ফ্ল্যাশ সেল",
    description="সবচেয়ে বেশি ছাড়ের ৮টি পণ্য আর অফার শেষ হওয়ার সময়।",
    responses={
        200: inline_serializer(
            name="FlashSaleResponse",
            fields={
                "ends_at": serializers.DateTimeField(),
                "products": ProductListSerializer(many=True),
            },
        )
    },
)
class FlashSaleView(APIView):
    """
    GET /catalog/flash-sale/  →  {ends_at, products}

    ছাড়ের অঙ্ক (আগের দাম − এখনকার দাম) যত বেশি, তত উপরে।
    শেষ হওয়ার সময় ধরা হয়েছে আজ রাত ১২টা।
    """

    permission_classes = [AllowAny]

    def get(self, request):
        ends_at = timezone.localtime().replace(hour=23, minute=59, second=59, microsecond=0)

        products = (
            live_products()
            .filter(compare_at_price__isnull=False, compare_at_price__gt=F("price"))
            .order_by((F("price") - F("compare_at_price")).asc())[:8]
        )

        return Response(
            {
                "ends_at": ends_at.isoformat(),
                "products": ProductListSerializer(
                    products, many=True, context={"request": request}
                ).data,
            }
        )
