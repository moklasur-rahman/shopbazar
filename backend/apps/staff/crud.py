"""
অ্যাডমিন প্যানেলের CRUD — ক্যাটাগরি, কুপন, ব্যানার, ইউজার, সেটিংস।

এই জিনিসগুলোর জন্য আগে Django admin-এ যেতে হতো। এখন আর নয়।
"""

from django.conf import settings
from django.db.models import Count
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.generics import ListAPIView
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.catalog.models import Banner, Category
from apps.promotions.models import Coupon
from apps.vendors.models import Vendor
from common.permissions import IsStaffUser

from .admin_serializers import (
    AdminBannerSerializer, AdminCategorySerializer, AdminCouponSerializer,
    AdminUserSerializer, VendorOptionSerializer,
)


class StaffViewSet(viewsets.ModelViewSet):
    permission_classes = [IsStaffUser]
    pagination_class = None


class AdminCategoryViewSet(StaffViewSet):
    serializer_class = AdminCategorySerializer

    def get_queryset(self):
        queryset = Category.objects.select_related("parent").order_by(
            "parent__sort_order", "sort_order", "name"
        )
        if self.request.query_params.get("top_level") == "true":
            queryset = queryset.filter(parent__isnull=True)
        return queryset

    def perform_destroy(self, instance):
        """
        যে ক্যাটাগরিতে পণ্য আছে সেটা মোছা যাবে না — মুছলে ওই পণ্যগুলো
        অনাথ হয়ে যেত (মডেলে PROTECT দেওয়া আছে, কিন্তু এখানে আগেই
        পড়ার মতো বার্তা দেওয়া ভালো)।
        """
        if instance.products.exists():
            from rest_framework.exceptions import ValidationError

            raise ValidationError({
                "detail": f"এই ক্যাটাগরিতে {instance.products.count()}টি পণ্য আছে — "
                          "আগে সেগুলো অন্য ক্যাটাগরিতে সরান।"
            })
        instance.delete()


class AdminCouponViewSet(StaffViewSet):
    serializer_class = AdminCouponSerializer

    def get_queryset(self):
        queryset = Coupon.objects.select_related("vendor").order_by("-created_at")
        scope = self.request.query_params.get("scope")
        if scope == "platform":
            queryset = queryset.filter(vendor__isnull=True)
        elif scope == "vendor":
            queryset = queryset.filter(vendor__isnull=False)
        return queryset

    @action(detail=False, methods=["get"], url_path="vendor-options")
    def vendor_options(self, request):
        """কুপন ফর্মের ড্রপডাউনের জন্য অনুমোদিত দোকানের তালিকা।"""
        vendors = Vendor.objects.filter(status=Vendor.Status.APPROVED).order_by("shop_name")
        return Response(VendorOptionSerializer(vendors, many=True).data)


class AdminBannerViewSet(StaffViewSet):
    serializer_class = AdminBannerSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        return Banner.objects.order_by("sort_order", "id")


class AdminUserListView(ListAPIView):
    """
    ইউজারের তালিকা — শুধু দেখা ও সচল/বন্ধ করা।

    এখান থেকে ইউজার তৈরি বা মোছা যায় না। তৈরি হয় রেজিস্ট্রেশনে, আর
    মুছে ফেললে তার অর্ডারের ইতিহাসও হারিয়ে যেত — তাই বন্ধ করাই নিয়ম।
    """

    permission_classes = [IsStaffUser]
    serializer_class = AdminUserSerializer

    def get_queryset(self):
        queryset = (
            User.objects.select_related("vendor")
            .annotate(orders_total=Count("orders"))
            .order_by("-date_joined")
        )
        role = self.request.query_params.get("role")
        if role:
            queryset = queryset.filter(role=role)

        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(full_name__icontains=search) | queryset.filter(
                phone__icontains=search
            )
        return queryset


@extend_schema(
    tags=["admin"], summary="ইউজার চালু / বন্ধ",
    description="action: activate · deactivate",
    request=None, responses={200: AdminUserSerializer},
)
class AdminUserActionView(APIView):
    permission_classes = [IsStaffUser]

    def post(self, request, pk, action):
        user = User.objects.filter(pk=pk).first()
        if user is None:
            return Response({"detail": "ইউজার পাওয়া যায়নি।"}, status=404)

        if user.pk == request.user.pk:
            return Response(
                {"detail": "নিজের অ্যাকাউন্ট নিজে বন্ধ করা যাবে না।"}, status=400
            )
        if user.is_superuser and not request.user.is_superuser:
            return Response(
                {"detail": "সুপারইউজারের অ্যাকাউন্টে হাত দেওয়ার অনুমতি নেই।"}, status=403
            )

        if action == "activate":
            user.is_active = True
        elif action == "deactivate":
            user.is_active = False
        else:
            return Response({"detail": "অজানা অ্যাকশন।"}, status=400)

        user.save(update_fields=["is_active"])
        return Response(AdminUserSerializer(user).data)


@extend_schema(
    tags=["admin"], summary="ব্যবসার নিয়ম (read-only)",
    responses={200: OpenApiResponse(description="কমিশন, ডেলিভারি চার্জ, হোল্ড পিরিয়ড")},
)
class AdminSettingsView(APIView):
    """
    GET /admin/settings/ — ব্যবসার নিয়মগুলো দেখা।

    এগুলো `config/settings.py`-এর MARKETPLACE ডিকশনারিতে, তাই API দিয়ে
    বদলানো যায় না — বদলাতে হলে ফাইলে বদলে সার্ভার রিস্টার্ট করতে হয়।
    এখানে দেখানো হচ্ছে যাতে অ্যাডমিন জানেন কোন নিয়মে সাইট চলছে।
    """

    permission_classes = [IsStaffUser]

    def get(self, request):
        rules = settings.MARKETPLACE
        return Response({
            "commission": {
                "default": rules["DEFAULT_COMMISSION_RATE"],
                "by_category": rules["COMMISSION_BY_CATEGORY"],
            },
            "shipping": {
                "inside_dhaka": rules["SHIPPING_INSIDE_DHAKA"],
                "outside_dhaka": rules["SHIPPING_OUTSIDE_DHAKA"],
                "extra_vendor_multiplier": rules["SHIPPING_EXTRA_VENDOR_MULTIPLIER"],
                "free_threshold": rules["FREE_SHIPPING_THRESHOLD"],
            },
            "payout_hold_days": rules["PAYOUT_HOLD_DAYS"],
            "max_qty_per_item": rules["MAX_QTY_PER_ITEM"],
            "low_stock_threshold": rules["LOW_STOCK_THRESHOLD"],
            "editable": False,
            "source": "backend/config/settings.py → MARKETPLACE",
            "note": (
                "এই মানগুলো ফ্রন্টএন্ডের src/config.js → RULES এর সাথে মিলিয়ে "
                "রাখতে হবে। না মিললে ক্রেতা কার্টে এক টাকা দেখবেন, চেকআউটে আরেক।"
            ),
        })
