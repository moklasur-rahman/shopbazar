"""
রিপোর্ট ও অ্যানালিটিক্স।

সব রিপোর্ট `VendorOrder` থেকে হিসাব করা হয়, `Order` থেকে নয় — কারণ
কমিশন আর ভেন্ডরের প্রাপ্য ওখানেই বসে। বাতিল হওয়া পার্সেল সবসময় বাদ যায়।
"""

import csv
from datetime import datetime, timedelta
from decimal import Decimal

from django.db.models import Count, DecimalField, ExpressionWrapper, F, Sum
from django.db.models.functions import TruncDay, TruncMonth
from django.http import HttpResponse
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import Product
from apps.orders.models import OrderItem, VendorOrder
from common.permissions import IsStaffUser

BN_MONTHS = [
    "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
    "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর",
]


def parse_range(request):
    """
    ?from=YYYY-MM-DD&to=YYYY-MM-DD — না দিলে গত ৩০ দিন।
    `to` তারিখটাও হিসাবে ধরা হয়, তাই এক দিন যোগ করে সীমা বসানো হয়।
    """
    today = timezone.localtime().replace(hour=0, minute=0, second=0, microsecond=0)

    def parse(value, fallback):
        if not value:
            return fallback
        try:
            naive = datetime.strptime(value, "%Y-%m-%d")
            return timezone.make_aware(naive)
        except (ValueError, TypeError):
            return fallback

    start = parse(request.query_params.get("from"), today - timedelta(days=29))
    end = parse(request.query_params.get("to"), today) + timedelta(days=1)
    return start, end


def base_parcels(start, end):
    return (
        VendorOrder.objects.filter(created_at__gte=start, created_at__lt=end)
        .exclude(status=VendorOrder.Status.CANCELLED)
    )


#: লাইনের মোট দাম = একক দাম × সংখ্যা।
#: output_field না দিলে Django বুঝতে পারে না Decimal × Integer এর ফল কী টাইপ
#: হবে, আর Sum() করার সময় FieldError দেয়।
LINE_TOTAL = ExpressionWrapper(
    F("unit_price") * F("quantity"),
    output_field=DecimalField(max_digits=14, decimal_places=2),
)


class ReportView(APIView):
    permission_classes = [IsStaffUser]


# ------------------------------------------------------------ বিক্রির রিপোর্ট


@extend_schema(
    tags=["admin"], summary="বিক্রির রিপোর্ট",
    parameters=[
        OpenApiParameter("from", str, description="YYYY-MM-DD"),
        OpenApiParameter("to", str, description="YYYY-MM-DD"),
        OpenApiParameter("group_by", str, enum=["day", "month"]),
    ],
    responses={200: OpenApiResponse(description="series ও totals")},
)
class SalesReportView(ReportView):
    """GET /admin/reports/sales/?from=&to=&group_by=day|month"""

    def get(self, request):
        start, end = parse_range(request)
        group_by = request.query_params.get("group_by", "day")
        parcels = base_parcels(start, end)

        trunc = TruncMonth if group_by == "month" else TruncDay
        rows = (
            parcels.annotate(bucket=trunc("created_at"))
            .values("bucket")
            .annotate(
                sales=Sum("subtotal"),
                discount=Sum("discount"),
                shipping=Sum("shipping_fee"),
                commission=Sum("commission_amount"),
                parcels=Count("id"),
            )
            .order_by("bucket")
        )

        series = []
        for row in rows:
            bucket = timezone.localtime(row["bucket"])
            label = (
                f"{BN_MONTHS[bucket.month - 1]} {bucket.year}"
                if group_by == "month"
                else f"{bucket.day} {BN_MONTHS[bucket.month - 1]}"
            )
            series.append({
                "label": label,
                "date": bucket.date().isoformat(),
                "sales": row["sales"] or Decimal("0"),
                "discount": row["discount"] or Decimal("0"),
                "shipping": row["shipping"] or Decimal("0"),
                "commission": row["commission"] or Decimal("0"),
                "parcels": row["parcels"],
            })

        totals = parcels.aggregate(
            sales=Sum("subtotal"),
            discount=Sum("discount"),
            shipping=Sum("shipping_fee"),
            commission=Sum("commission_amount"),
            parcels=Count("id"),
        )

        delivered = parcels.filter(status=VendorOrder.Status.DELIVERED).count()

        return Response({
            "from": start.date().isoformat(),
            "to": (end - timedelta(days=1)).date().isoformat(),
            "group_by": group_by,
            "series": series,
            "totals": {
                "sales": totals["sales"] or Decimal("0"),
                "discount": totals["discount"] or Decimal("0"),
                "shipping": totals["shipping"] or Decimal("0"),
                "commission": totals["commission"] or Decimal("0"),
                "parcels": totals["parcels"] or 0,
                "delivered": delivered,
                # ডেলিভারি হার — কত শতাংশ পার্সেল সফলভাবে পৌঁছেছে
                "delivery_rate": round(
                    (delivered / totals["parcels"] * 100) if totals["parcels"] else 0, 1
                ),
            },
        })


# ------------------------------------------------------- ভেন্ডর-ভিত্তিক আয়


@extend_schema(
    tags=["admin"], summary="দোকান-ভিত্তিক আয়",
    responses={200: OpenApiResponse(description="প্রতি দোকানের বিক্রি, কমিশন, প্রাপ্য")},
)
class VendorReportView(ReportView):
    """GET /admin/reports/vendors/ — কোন দোকান কত আনল, প্ল্যাটফর্ম কত পেল।"""

    def get(self, request):
        start, end = parse_range(request)

        rows = (
            base_parcels(start, end)
            .values("vendor__id", "vendor__shop_name", "vendor__slug", "vendor__district")
            .annotate(
                sales=Sum("subtotal"),
                commission=Sum("commission_amount"),
                payable=Sum("payable"),
                parcels=Count("id"),
            )
            .order_by("-sales")
        )

        return Response({
            "from": start.date().isoformat(),
            "to": (end - timedelta(days=1)).date().isoformat(),
            "results": [
                {
                    "vendor_id": row["vendor__id"],
                    "shop_name": row["vendor__shop_name"],
                    "slug": row["vendor__slug"],
                    "district": row["vendor__district"],
                    "sales": row["sales"] or Decimal("0"),
                    "commission": row["commission"] or Decimal("0"),
                    "payable": row["payable"] or Decimal("0"),
                    "parcels": row["parcels"],
                }
                for row in rows
            ],
        })


# ------------------------------------------------------- পণ্য ও ক্যাটাগরি


@extend_schema(
    tags=["admin"], summary="পণ্য ও ক্যাটাগরির রিপোর্ট",
    responses={200: OpenApiResponse(description="top_products, by_category, low_stock")},
)
class ProductReportView(ReportView):
    """GET /admin/reports/products/ — সবচেয়ে বেশি বিক্রি হওয়া পণ্য ও ক্যাটাগরি।"""

    def get(self, request):
        start, end = parse_range(request)

        items = OrderItem.objects.filter(
            vendor_order__created_at__gte=start,
            vendor_order__created_at__lt=end,
        ).exclude(vendor_order__status=VendorOrder.Status.CANCELLED)

        # ⚠️ অ্যাগ্রিগেটের নাম `quantity` রাখা যাবে না — তাহলে LINE_TOTAL এর
        # ভেতরের F("quantity") মডেলের ফিল্ড না বুঝে ওই অ্যাগ্রিগেটকেই ধরে
        # আর Django "is an aggregate" বলে থেমে যায়। তাই `sold` নাম দেওয়া।
        top_products = (
            items.values("product_title", "product_slug")
            .annotate(sold=Sum("quantity"), revenue=Sum(LINE_TOTAL))
            .order_by("-revenue")[:15]
        )

        by_category = (
            items.filter(variant__isnull=False)
            .values("variant__product__category__name", "variant__product__category__slug")
            .annotate(sold=Sum("quantity"), revenue=Sum(LINE_TOTAL))
            .order_by("-revenue")
        )

        low_stock = (
            Product.objects.filter(status=Product.Status.LIVE, stock__lt=15)
            .select_related("vendor")
            .order_by("stock")[:20]
        )

        return Response({
            "from": start.date().isoformat(),
            "to": (end - timedelta(days=1)).date().isoformat(),
            "top_products": [
                {
                    "title": row["product_title"],
                    "slug": row["product_slug"],
                    "quantity": row["sold"],
                    "revenue": row["revenue"] or Decimal("0"),
                }
                for row in top_products
            ],
            "by_category": [
                {
                    "name": row["variant__product__category__name"] or "অজানা",
                    "slug": row["variant__product__category__slug"] or "",
                    "quantity": row["sold"],
                    "revenue": row["revenue"] or Decimal("0"),
                }
                for row in by_category
            ],
            "low_stock": [
                {
                    "title": p.title,
                    "slug": p.slug,
                    "vendor": p.vendor.shop_name,
                    "stock": p.stock,
                }
                for p in low_stock
            ],
        })


# ---------------------------------------------------------------- এক্সপোর্ট


@extend_schema(
    tags=["admin"], summary="CSV এক্সপোর্ট",
    parameters=[OpenApiParameter("type", str, enum=["orders", "vendors", "products"])],
    responses={(200, "text/csv"): OpenApiTypes.BINARY},
)
class ExportView(ReportView):
    """
    GET /admin/reports/export/?type=orders|vendors|products&from=&to=

    UTF-8 BOM সহ CSV — এটা না দিলে Excel বাংলা লেখা ভেঙে দেখায়
    (আসলে ফাইল ঠিক থাকে, Excel-ই এনকোডিং ভুল ধরে)।
    """

    EXPORTS = {
        "orders": "orders",
        "vendors": "vendors",
        "products": "products",
    }

    def get(self, request):
        kind = request.query_params.get("type", "orders")
        if kind not in self.EXPORTS:
            return Response({"detail": "অজানা রিপোর্ট।"}, status=400)

        start, end = parse_range(request)
        filename = f"shopbazar-{kind}-{start.date()}-to-{(end - timedelta(days=1)).date()}.csv"

        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response.write("﻿")  # Excel-এর জন্য BOM

        writer = csv.writer(response)
        getattr(self, f"_write_{kind}")(writer, start, end)
        return response

    def _write_orders(self, writer, start, end):
        writer.writerow([
            "অর্ডার নম্বর", "পার্সেল", "তারিখ", "ক্রেতা", "মোবাইল", "দোকান",
            "অবস্থা", "পণ্যমূল্য", "ছাড়", "ডেলিভারি", "কমিশন", "ভেন্ডরের প্রাপ্য",
        ])
        parcels = (
            base_parcels(start, end)
            .select_related("order__customer", "vendor")
            .order_by("-created_at")
        )
        for parcel in parcels:
            order = parcel.order
            writer.writerow([
                order.order_number,
                parcel.sub_number,
                timezone.localtime(parcel.created_at).strftime("%Y-%m-%d %H:%M"),
                order.customer.full_name,
                order.customer.phone,
                parcel.vendor.shop_name,
                parcel.get_status_display(),
                parcel.subtotal,
                parcel.discount,
                parcel.shipping_fee,
                parcel.commission_amount,
                parcel.payable,
            ])

    def _write_vendors(self, writer, start, end):
        writer.writerow([
            "দোকান", "জেলা", "অবস্থা", "পার্সেল", "বিক্রি", "কমিশন", "প্রাপ্য",
        ])
        rows = (
            base_parcels(start, end)
            .values("vendor__shop_name", "vendor__district", "vendor__status")
            .annotate(
                parcels=Count("id"),
                sales=Sum("subtotal"),
                commission=Sum("commission_amount"),
                payable=Sum("payable"),
            )
            .order_by("-sales")
        )
        for row in rows:
            writer.writerow([
                row["vendor__shop_name"],
                row["vendor__district"],
                row["vendor__status"],
                row["parcels"],
                row["sales"] or 0,
                row["commission"] or 0,
                row["payable"] or 0,
            ])

    def _write_products(self, writer, start, end):
        writer.writerow(["পণ্য", "দোকান", "ক্যাটাগরি", "দাম", "স্টক", "মোট বিক্রি", "অবস্থা"])
        for product in Product.objects.select_related("vendor", "category").order_by("-sold_count"):
            writer.writerow([
                product.title,
                product.vendor.shop_name,
                product.category.name,
                product.price,
                product.stock,
                product.sold_count,
                product.get_status_display(),
            ])
