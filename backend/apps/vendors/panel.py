"""
ভেন্ডর প্যানেলের API।

একটাই নিরাপত্তা নিয়ম, বারবার মনে রাখার মতো:
কোনো ভিউ কখনো URL বা query param থেকে vendor আইডি নেয় না।
সবসময় `request.user.vendor` — নাহলে একজন বিক্রেতা অন্যজনের আইডি বসিয়ে
তার অর্ডার, বিক্রি আর ক্রেতার ফোন নম্বর দেখে ফেলবে। মাল্টি-ভেন্ডর
সাইটের সবচেয়ে সাধারণ নিরাপত্তা বাগ এটাই।
"""

from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from django.utils.crypto import get_random_string
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status as http_status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.generics import ListAPIView
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import Category, Product, ProductImage, ProductVariant
from apps.catalog.serializers import ProductListSerializer, ProductSerializer
from apps.orders.models import VendorOrder
from apps.orders.serializers import StatusUpdateSerializer, VendorOrderSerializer
from apps.orders.services import settle_vendor_order
from apps.payouts.models import LedgerEntry, Payout
from apps.payouts.serializers import LedgerEntrySerializer, PayoutSerializer
from common.permissions import IsApprovedVendor, IsVendor
from common.utils import unique_slug

from .models import VendorKYC
from .serializers import VendorKYCSerializer, VendorProductWriteSerializer

BN_WEEKDAYS = ["সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি", "রবি"]


class VendorScopedMixin:
    permission_classes = [IsApprovedVendor]

    @property
    def vendor(self):
        """
        লগইন করা ব্যবহারকারীর দোকান।

        `getattr` ব্যবহার করা হয়েছে কারণ OpenAPI স্কিমা তৈরির সময়
        drf-spectacular AnonymousUser দিয়ে get_queryset() ডাকে — তখন
        `.vendor` না থাকায় এক্সেপশন হতো আর ওই ভিউ ডকুমেন্টেশন থেকে
        বাদ পড়ে যেত।
        """
        return getattr(self.request.user, "vendor", None)

    def empty_or(self, queryset_factory, model):
        """স্কিমা তৈরির সময় বা দোকান না থাকলে খালি queryset।"""
        if getattr(self, "swagger_fake_view", False) or self.vendor is None:
            return model.objects.none()
        return queryset_factory()


# ------------------------------------------------------- আবেদন ও KYC

@extend_schema(
    tags=["vendor-panel"],
    summary="দোকানের আবেদন ও KYC",
    description="অনুমোদনের অপেক্ষায় থাকা বিক্রেতাও এটা ব্যবহার করতে পারেন।",
    request=VendorKYCSerializer,
    responses={200: OpenApiResponse(description="vendor, kyc, checklist")},
)
class VendorApplicationView(APIView):
    """
    GET/PUT /vendor/application/

    অনুমোদনের অপেক্ষায় থাকা বিক্রেতাও এটা ব্যবহার করতে পারেন — তাই
    IsApprovedVendor নয়, IsVendor। এখান থেকেই তিনি নিজের আবেদনের অবস্থা
    দেখেন আর NID/বিকাশের তথ্য জমা দেন।
    """

    permission_classes = [IsVendor]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def _payload(self, vendor, request):
        kyc = getattr(vendor, "kyc", None)
        return {
            "vendor": {
                "slug": vendor.slug,
                "shop_name": vendor.shop_name,
                "status": vendor.status,
                "is_verified": vendor.is_verified,
                "district": vendor.district,
                "created_at": vendor.created_at,
            },
            "kyc": VendorKYCSerializer(kyc, context={"request": request}).data if kyc else None,
            # কোন কোন ধাপ শেষ — pending পাতায় চেকলিস্ট দেখানোর জন্য
            "checklist": {
                "account": True,
                # ছবি ছাড়া অ্যাডমিন যাচাই করতে পারেন না, তাই নম্বরের সাথে
                # দুই পাশের ছবিও থাকতে হবে
                "documents": bool(
                    kyc and kyc.nid_number and kyc.nid_front and kyc.nid_back
                ),
                "payout": bool(kyc and (kyc.bkash_number or kyc.bank_account_number)),
                "approved": vendor.is_approved,
            },
        }

    def get(self, request):
        return Response(self._payload(request.user.vendor, request))

    def put(self, request):
        vendor = request.user.vendor
        kyc, _ = VendorKYC.objects.get_or_create(vendor=vendor)

        serializer = VendorKYCSerializer(
            kyc, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        district = str(request.data.get("district", "")).strip()
        if district:
            vendor.district = district
            vendor.save(update_fields=["district", "updated_at"])

        return Response(self._payload(vendor, request))


# ------------------------------------------------------------------ stats


@extend_schema(
    tags=["vendor-panel"],
    summary="ড্যাশবোর্ডের সংখ্যা",
    responses={200: OpenApiResponse(description="বিক্রি, অপেক্ষমাণ অর্ডার, ব্যালেন্স, ৭ দিনের ট্রেন্ড")},
)
class VendorStatsView(VendorScopedMixin, APIView):
    """GET /vendor/stats/ — ড্যাশবোর্ডের সব সংখ্যা এক কলে।"""

    def get(self, request):
        vendor = self.vendor
        now = timezone.localtime()
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        month_start = today.replace(day=1)

        parcels = VendorOrder.objects.filter(vendor=vendor).exclude(
            status=VendorOrder.Status.CANCELLED
        )

        today_sales = parcels.filter(created_at__gte=today).aggregate(
            total=Sum("subtotal")
        )["total"] or Decimal("0")

        month_sales = parcels.filter(created_at__gte=month_start).aggregate(
            total=Sum("subtotal")
        )["total"] or Decimal("0")

        products = Product.objects.filter(vendor=vendor)

        # গত ৭ দিনের বিক্রি — চার্টের জন্য
        trend = []
        for offset in range(6, -1, -1):
            day_start = today - timedelta(days=offset)
            day_end = day_start + timedelta(days=1)
            amount = parcels.filter(
                created_at__gte=day_start, created_at__lt=day_end
            ).aggregate(total=Sum("subtotal"))["total"] or Decimal("0")
            trend.append({
                "day": BN_WEEKDAYS[day_start.weekday()],
                "amount": amount,
            })

        return Response({
            "today_sales": today_sales,
            "month_sales": month_sales,
            "pending_orders": parcels.filter(
                status__in=[VendorOrder.Status.PENDING, VendorOrder.Status.CONFIRMED]
            ).count(),
            "low_stock": products.filter(stock__lt=15).count(),
            "total_products": products.count(),
            "available_balance": LedgerEntry.available_balance(vendor),
            "on_hold": LedgerEntry.on_hold_balance(vendor),
            "rating": vendor.rating_avg,
            "sales_trend": trend,
        })


# --------------------------------------------------------------- products


class VendorProductViewSet(VendorScopedMixin, viewsets.ModelViewSet):
    search_fields = ["title"]
    ordering = ["-created_at"]

    queryset = Product.objects.none()  # স্কিমা জেনারেটরের জন্য

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False) or self.vendor is None:
            return Product.objects.none()

        # ✅ নিজের পণ্য ছাড়া কিছুই দেখা যাবে না
        queryset = Product.objects.filter(vendor=self.vendor).select_related(
            "category", "vendor"
        ).prefetch_related("variants", "images")

        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(title__icontains=search)

        return queryset.order_by("-created_at")

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return VendorProductWriteSerializer
        return ProductListSerializer if self.action == "list" else ProductSerializer

    def _save_product(self, serializer, instance=None):
        data = serializer.validated_data
        vendor = self.vendor
        category = Category.objects.filter(slug=data.get("category")).first()

        with transaction.atomic():
            if instance is None:
                instance = Product(vendor=vendor)
                instance.slug = unique_slug(Product, data["title"], fallback="product")

            instance.title = data.get("title", instance.title)
            instance.description = data.get("description", instance.description)
            if category:
                instance.category = category
            instance.status = data.get("status", instance.status)
            instance.free_shipping = data.get("price", instance.price) >= 2000
            instance.save()

            # দাম ও স্টক ভ্যারিয়েন্টে থাকে। প্যানেলের সহজ ফর্মে একটাই
            # ডিফল্ট ভ্যারিয়েন্ট ব্যবহার হয়; একাধিক ভ্যারিয়েন্ট লাগলে
            # অ্যাডমিন থেকে যোগ করা যায়।
            variant = instance.variants.first()
            if variant is None:
                variant = ProductVariant(
                    product=instance,
                    sku=f"{instance.slug[:16].upper()}-{get_random_string(4).upper()}",
                    options={},
                )
            variant.price = data.get("price", variant.price or Decimal("0"))
            variant.compare_at_price = data.get("compare_at_price")
            variant.stock = data.get("stock", variant.stock or 0)
            variant.save()

            images = data.get("images")
            if images is not None:
                instance.images.all().delete()
                ProductImage.objects.bulk_create([
                    ProductImage(product=instance, image_url=url, sort_order=i)
                    for i, url in enumerate(images)
                ])

        instance.refresh_from_db()
        return instance

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = self._save_product(serializer)
        return Response(
            ProductSerializer(product, context={"request": request}).data,
            status=http_status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(data=request.data, partial=kwargs.pop("partial", False))
        serializer.is_valid(raise_exception=True)
        product = self._save_product(serializer, instance)
        return Response(ProductSerializer(product, context={"request": request}).data)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, partial=True, **kwargs)


# ----------------------------------------------------------------- orders


class VendorOrderViewSet(VendorScopedMixin, viewsets.ModelViewSet):
    serializer_class = VendorOrderSerializer
    http_method_names = ["get", "patch", "post", "head", "options"]
    queryset = VendorOrder.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False) or self.vendor is None:
            return VendorOrder.objects.none()

        # ✅ শুধু নিজের পার্সেল
        queryset = (
            VendorOrder.objects.filter(vendor=self.vendor)
            .select_related("vendor", "order")
            .prefetch_related("items")
        )
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset.order_by("-created_at")

    def _advance(self, vendor_order, new_status):
        """
        ভেন্ডর এক ধাপ করে সামনে এগোতে পারে, লাফ দিতে পারে না —
        নাহলে "প্যাক না করেই ডেলিভারি হয়েছে" ধরনের অবস্থা তৈরি হবে।
        """
        allowed = vendor_order.next_status()
        if new_status != allowed:
            return Response(
                {"detail": f"এখন শুধু “{allowed}” করা যাবে।" if allowed
                 else "এই অর্ডারের অবস্থা আর বদলানো যাবে না।"},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        vendor_order.status = new_status

        if new_status == VendorOrder.Status.SHIPPED and not vendor_order.tracking_code:
            vendor_order.courier = "পাঠাও কুরিয়ার"
            vendor_order.tracking_code = f"PTH{get_random_string(7, '0123456789')}"

        vendor_order.save(update_fields=["status", "courier", "tracking_code", "updated_at"])

        # ডেলিভারি হলে তবেই ভেন্ডরের লেজারে টাকা বসে
        if new_status == VendorOrder.Status.DELIVERED:
            settle_vendor_order(vendor_order)

        return Response(
            VendorOrderSerializer(vendor_order, context={"request": self.request}).data
        )

    def partial_update(self, request, *args, **kwargs):
        vendor_order = self.get_object()
        payload = StatusUpdateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        return self._advance(vendor_order, payload.validated_data["status"])

    def update(self, request, *args, **kwargs):
        return self.partial_update(request, *args, **kwargs)

    @action(detail=True, methods=["post"], url_path="ship")
    def ship(self, request, pk=None):
        """কুরিয়ারে দেওয়ার শর্টকাট — আসল API যুক্ত হলে এখানেই বসবে।"""
        return self._advance(self.get_object(), VendorOrder.Status.SHIPPED)


# ---------------------------------------------------------------- payouts


class VendorLedgerView(VendorScopedMixin, ListAPIView):
    serializer_class = LedgerEntrySerializer
    pagination_class = None
    queryset = LedgerEntry.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False) or self.vendor is None:
            return LedgerEntry.objects.none()
        return LedgerEntry.objects.filter(vendor=self.vendor).select_related("vendor_order")[:100]


@extend_schema(
    tags=["vendor-panel"],
    summary="ব্যালেন্স",
    responses={200: OpenApiResponse(description="available, on_hold")},
)
class VendorBalanceView(VendorScopedMixin, APIView):
    def get(self, request):
        vendor = self.vendor
        return Response({
            "available": LedgerEntry.available_balance(vendor),
            "on_hold": LedgerEntry.on_hold_balance(vendor),
        })


class VendorPayoutViewSet(VendorScopedMixin, viewsets.ModelViewSet):
    serializer_class = PayoutSerializer
    http_method_names = ["get", "post", "head", "options"]
    pagination_class = None
    queryset = Payout.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False) or self.vendor is None:
            return Payout.objects.none()
        return Payout.objects.filter(vendor=self.vendor)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        vendor = self.vendor
        available = LedgerEntry.available_balance(vendor)

        try:
            amount = Decimal(str(request.data.get("amount", available)))
        except (TypeError, ValueError):
            return Response({"detail": "টাকার অঙ্কটি বুঝতে পারিনি।"},
                            status=http_status.HTTP_400_BAD_REQUEST)

        if amount <= 0:
            return Response({"detail": "তোলার মতো টাকা নেই।"},
                            status=http_status.HTTP_400_BAD_REQUEST)
        if amount > available:
            return Response(
                {"detail": f"এখন সর্বোচ্চ ৳{int(available)} তোলা যাবে।"},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        kyc = getattr(vendor, "kyc", None)
        payout = Payout.objects.create(
            vendor=vendor,
            amount=amount,
            status=Payout.Status.PROCESSING,
            method=kyc.payout_target if kyc else "নির্ধারিত হয়নি",
        )

        # 🔒 যে এন্ট্রিগুলোর টাকা দেওয়া হচ্ছে সেগুলো এই পে-আউটে বেঁধে দেওয়া হয়,
        # তাই একই টাকা দ্বিতীয়বার তোলা অসম্ভব।
        LedgerEntry.objects.filter(
            vendor=vendor, payout__isnull=True, release_at__lte=timezone.now()
        ).update(payout=payout)

        return Response(PayoutSerializer(payout).data, status=http_status.HTTP_201_CREATED)
