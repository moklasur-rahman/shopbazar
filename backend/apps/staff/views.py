"""
প্ল্যাটফর্ম অ্যাডমিনের API।

Django-র নিজস্ব অ্যাডমিন থেকেই সব করা যেত, কিন্তু রোজকার কাজগুলো —
বিক্রেতা অনুমোদন, পণ্য মডারেশন, পে-আউট — বারবার ওখানে গিয়ে করা
ক্লান্তিকর আর দেখতেও বেমানান। তাই সেই কাজগুলোর জন্য এই API, আর
React-এ তার নিজের প্যানেল।

Django admin মুছে ফেলা হয়নি — ডেটাবেসে হাত দেওয়ার মতো অস্বাভাবিক
কাজের জন্য ওটাই এখনো সবচেয়ে নিরাপদ জায়গা।
"""

from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status as http_status
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.catalog.models import Product
from apps.orders.models import Order, VendorOrder
from apps.payouts.models import LedgerEntry, Payout
from apps.vendors.models import Vendor, VendorKYC
from common.permissions import IsStaffUser

from .serializers import (
    AdminOrderSerializer, AdminPayoutSerializer, AdminProductSerializer,
    AdminVendorDetailSerializer, AdminVendorListSerializer,
)

BN_WEEKDAYS = ["সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি", "রবি"]


class StaffView(APIView):
    permission_classes = [IsStaffUser]


class StaffListView(ListAPIView):
    permission_classes = [IsStaffUser]


# ------------------------------------------------------------------ stats


@extend_schema(
    tags=["admin"],
    summary="প্ল্যাটফর্মের সারসংক্ষেপ",
    responses={200: OpenApiResponse(description="GMV, কমিশন, দোকান/পণ্যের গণনা, করণীয়")},
)
class AdminStatsView(StaffView):
    """GET /admin/stats/ — পুরো প্ল্যাটফর্মের অবস্থা এক নজরে।"""

    def get(self, request):
        now = timezone.localtime()
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        month_start = today.replace(day=1)

        parcels = VendorOrder.objects.exclude(status=VendorOrder.Status.CANCELLED)

        gmv_today = parcels.filter(created_at__gte=today).aggregate(
            total=Sum("subtotal")
        )["total"] or Decimal("0")
        gmv_month = parcels.filter(created_at__gte=month_start).aggregate(
            total=Sum("subtotal")
        )["total"] or Decimal("0")
        commission_month = parcels.filter(created_at__gte=month_start).aggregate(
            total=Sum("commission_amount")
        )["total"] or Decimal("0")

        # গত ৭ দিনের বিক্রি
        trend = []
        for offset in range(6, -1, -1):
            day_start = today - timedelta(days=offset)
            amount = parcels.filter(
                created_at__gte=day_start, created_at__lt=day_start + timedelta(days=1)
            ).aggregate(total=Sum("subtotal"))["total"] or Decimal("0")
            trend.append({"day": BN_WEEKDAYS[day_start.weekday()], "amount": amount})

        vendor_counts = Vendor.objects.aggregate(
            total=Count("id"),
            pending=Count("id", filter=Q(status=Vendor.Status.PENDING)),
            approved=Count("id", filter=Q(status=Vendor.Status.APPROVED)),
            suspended=Count("id", filter=Q(status=Vendor.Status.SUSPENDED)),
        )
        product_counts = Product.objects.aggregate(
            total=Count("id"),
            pending=Count("id", filter=Q(status=Product.Status.PENDING)),
            live=Count("id", filter=Q(status=Product.Status.LIVE)),
        )

        return Response({
            "gmv_today": gmv_today,
            "gmv_month": gmv_month,
            "commission_month": commission_month,
            "orders_today": Order.objects.filter(created_at__gte=today).count(),
            "orders_total": Order.objects.count(),
            "customers": User.objects.filter(role=User.Role.CUSTOMER).count(),
            "vendors": vendor_counts,
            "products": product_counts,
            "payouts_pending": Payout.objects.filter(
                status__in=[Payout.Status.REQUESTED, Payout.Status.PROCESSING]
            ).count(),
            "payouts_pending_amount": Payout.objects.filter(
                status__in=[Payout.Status.REQUESTED, Payout.Status.PROCESSING]
            ).aggregate(total=Sum("amount"))["total"] or Decimal("0"),
            "sales_trend": trend,
            # ড্যাশবোর্ডের "যা করা বাকি" তালিকা
            "todo": {
                "vendor_approvals": vendor_counts["pending"],
                "product_approvals": product_counts["pending"],
                "payouts": Payout.objects.filter(status=Payout.Status.PROCESSING).count(),
            },
        })


# ---------------------------------------------------------------- vendors


class AdminVendorListView(StaffListView):
    serializer_class = AdminVendorListSerializer

    def get_queryset(self):
        queryset = (
            Vendor.objects.select_related("owner", "kyc")
            .annotate(product_total=Count("products"))
            .order_by("-created_at")
        )
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(shop_name__icontains=search)
                | Q(owner__phone__icontains=search)
                | Q(owner__full_name__icontains=search)
            )
        return queryset


@extend_schema(
    tags=["admin"], summary="দোকানের বিস্তারিত (KYC সহ)",
    responses={200: AdminVendorDetailSerializer},
)
class AdminVendorDetailView(StaffView):
    def get(self, request, pk):
        vendor = Vendor.objects.select_related("owner", "kyc").filter(pk=pk).first()
        if vendor is None:
            return Response({"detail": "দোকানটি পাওয়া যায়নি।"}, status=404)
        return Response(
            AdminVendorDetailSerializer(vendor, context={"request": request}).data
        )


@extend_schema(
    tags=["admin"],
    summary="দোকান অনুমোদন / স্থগিত",
    description="action: approve · suspend · reactivate",
    request=None, responses={200: AdminVendorDetailSerializer},
)
class AdminVendorActionView(StaffView):
    """
    POST /admin/vendors/<id>/approve/  বা  /suspend/

    অনুমোদন দিলে দোকান সাথে সাথে সাইটে দেখা যায় এবং ভেন্ডর প্যানেল
    খুলে যায়। স্থগিত করলে উল্টোটা — পণ্যও সাইট থেকে হারিয়ে যায়।
    """

    def post(self, request, pk, action):
        vendor = Vendor.objects.select_related("kyc").filter(pk=pk).first()
        if vendor is None:
            return Response({"detail": "দোকানটি পাওয়া যায়নি।"}, status=404)

        note = str(request.data.get("note", "")).strip()

        if action == "approve":
            kyc = getattr(vendor, "kyc", None)
            if not (kyc and kyc.nid_number and kyc.nid_front and kyc.nid_back):
                return Response(
                    {"detail": "NID নম্বর ও দুই পাশের ছবি ছাড়া অনুমোদন দেওয়া যাবে না।"},
                    status=http_status.HTTP_400_BAD_REQUEST,
                )
            vendor.status = Vendor.Status.APPROVED
            vendor.is_verified = True
            VendorKYC.objects.filter(vendor=vendor).update(
                reviewed_at=timezone.now(), review_note=note
            )

        elif action == "suspend":
            vendor.status = Vendor.Status.SUSPENDED
            VendorKYC.objects.filter(vendor=vendor).update(review_note=note)

        elif action == "reactivate":
            vendor.status = Vendor.Status.APPROVED

        else:
            return Response({"detail": "অজানা অ্যাকশন।"}, status=400)

        vendor.save(update_fields=["status", "is_verified", "updated_at"])
        return Response(
            AdminVendorDetailSerializer(vendor, context={"request": request}).data
        )


# --------------------------------------------------------------- products


class AdminProductListView(StaffListView):
    serializer_class = AdminProductSerializer

    def get_queryset(self):
        queryset = (
            Product.objects.select_related("vendor", "category")
            .prefetch_related("images")
            .order_by("-created_at")
        )
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(vendor__shop_name__icontains=search)
            )
        return queryset


@extend_schema(
    tags=["admin"], summary="পণ্য প্রকাশ / বাতিল",
    description="action: approve · reject · unpublish",
    request=None, responses={200: AdminProductSerializer},
)
class AdminProductActionView(StaffView):
    def post(self, request, pk, action):
        product = Product.objects.filter(pk=pk).first()
        if product is None:
            return Response({"detail": "পণ্যটি পাওয়া যায়নি।"}, status=404)

        if action == "approve":
            product.status = Product.Status.LIVE
        elif action == "reject":
            product.status = Product.Status.REJECTED
        elif action == "unpublish":
            product.status = Product.Status.DRAFT
        else:
            return Response({"detail": "অজানা অ্যাকশন।"}, status=400)

        product.save(update_fields=["status", "updated_at"])
        return Response(
            AdminProductSerializer(product, context={"request": request}).data
        )


# ----------------------------------------------------------------- orders


class AdminOrderListView(StaffListView):
    serializer_class = AdminOrderSerializer

    def get_queryset(self):
        queryset = (
            Order.objects.select_related("customer")
            .prefetch_related("vendor_orders__vendor")
            .order_by("-created_at")
        )
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(order_number__icontains=search)
                | Q(customer__phone__icontains=search)
                | Q(customer__full_name__icontains=search)
            )
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(vendor_orders__status=status_filter).distinct()
        return queryset


# ---------------------------------------------------------------- payouts


class AdminPayoutListView(StaffListView):
    serializer_class = AdminPayoutSerializer

    def get_queryset(self):
        queryset = Payout.objects.select_related("vendor").order_by("-created_at")
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset


@extend_schema(
    tags=["admin"], summary="পে-আউট পরিশোধিত / ব্যর্থ",
    description="action: mark-paid · mark-failed",
    request=None, responses={200: AdminPayoutSerializer},
)
class AdminPayoutActionView(StaffView):
    """
    POST /admin/payouts/<id>/mark-paid/

    টাকা আসলে বিকাশ/ব্যাংকে পাঠানোর পর এখানে চিহ্নিত করা হয়।
    লেজারের এন্ট্রিগুলো আগেই এই পে-আউটে বাঁধা আছে, তাই এখানে শুধু
    অবস্থা বদলায় — টাকার হিসাব নড়ে না।
    """

    def post(self, request, pk, action):
        payout = Payout.objects.select_related("vendor").filter(pk=pk).first()
        if payout is None:
            return Response({"detail": "পে-আউটটি পাওয়া যায়নি।"}, status=404)

        if action == "mark-paid":
            payout.status = Payout.Status.PAID
            payout.paid_at = timezone.now()
            payout.reference = str(request.data.get("reference", "")).strip()
            payout.save(update_fields=["status", "paid_at", "reference", "updated_at"])

        elif action == "mark-failed":
            payout.status = Payout.Status.FAILED
            payout.save(update_fields=["status", "updated_at"])
            # ব্যর্থ হলে এন্ট্রিগুলো আবার খুলে দেওয়া হয়, যাতে ভেন্ডর
            # আবার তুলতে পারেন — নাহলে টাকাটা চিরতরে আটকে থাকত
            LedgerEntry.objects.filter(payout=payout).update(payout=None)

        else:
            return Response({"detail": "অজানা অ্যাকশন।"}, status=400)

        return Response(AdminPayoutSerializer(payout).data)
