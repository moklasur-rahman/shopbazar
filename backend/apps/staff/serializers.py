"""
প্ল্যাটফর্ম অ্যাডমিনের সিরিয়ালাইজার।

ভেন্ডরের নিজের সিরিয়ালাইজার থেকে আলাদা — কারণ অ্যাডমিন এমন জিনিস
দেখেন যা ক্রেতা বা অন্য বিক্রেতা কখনো দেখবেন না: NID-র ছবি, মালিকের
ফোন নম্বর, আবেদনের অবস্থা।
"""

from rest_framework import serializers

from apps.catalog.models import Product
from apps.orders.models import Order, VendorOrder
from apps.payouts.models import Payout
from apps.vendors.models import Vendor
from common.serializers import absolute


class AdminVendorListSerializer(serializers.ModelSerializer):
    owner_name = serializers.CharField(source="owner.full_name", read_only=True)
    owner_phone = serializers.CharField(source="owner.phone", read_only=True)
    logo = serializers.SerializerMethodField()
    documents_ready = serializers.SerializerMethodField()
    product_count = serializers.SerializerMethodField()

    class Meta:
        model = Vendor
        fields = [
            "id", "slug", "shop_name", "logo", "district", "status", "is_verified",
            "commission_rate", "owner_name", "owner_phone", "documents_ready",
            "product_count", "created_at",
        ]

    def get_logo(self, obj) -> str | None:
        return absolute(self.context.get("request"), obj.logo_display)

    def get_documents_ready(self, obj) -> bool:
        kyc = getattr(obj, "kyc", None)
        return bool(kyc and kyc.nid_number and kyc.nid_front and kyc.nid_back)

    def get_product_count(self, obj) -> int:
        cached = getattr(obj, "product_total", None)
        return cached if cached is not None else obj.products.count()


class AdminVendorDetailSerializer(AdminVendorListSerializer):
    """অনুমোদনের সিদ্ধান্ত নিতে যা যা দেখা দরকার — সব এক জায়গায়।"""

    kyc = serializers.SerializerMethodField()
    banner = serializers.SerializerMethodField()
    owner_email = serializers.CharField(source="owner.email", read_only=True)
    stats = serializers.SerializerMethodField()

    class Meta(AdminVendorListSerializer.Meta):
        fields = AdminVendorListSerializer.Meta.fields + [
            "banner", "owner_email", "ships_in_days", "response_rate",
            "rating_avg", "rating_count", "kyc", "stats",
        ]

    def get_banner(self, obj) -> str | None:
        return absolute(self.context.get("request"), obj.banner_display)

    def get_kyc(self, obj) -> dict | None:
        kyc = getattr(obj, "kyc", None)
        if not kyc:
            return None
        request = self.context.get("request")
        return {
            "nid_number": kyc.nid_number,
            "nid_front": absolute(request, kyc.nid_front.url) if kyc.nid_front else None,
            "nid_back": absolute(request, kyc.nid_back.url) if kyc.nid_back else None,
            "trade_license": (
                absolute(request, kyc.trade_license.url) if kyc.trade_license else None
            ),
            "bkash_number": kyc.bkash_number,
            "bank_name": kyc.bank_name,
            "bank_account_name": kyc.bank_account_name,
            "bank_account_number": kyc.bank_account_number,
            "payout_target": kyc.payout_target,
            "reviewed_at": kyc.reviewed_at,
            "review_note": kyc.review_note,
        }

    def get_stats(self, obj) -> dict | None:
        parcels = VendorOrder.objects.filter(vendor=obj).exclude(status="cancelled")
        return {
            "orders": parcels.count(),
            "products": obj.products.count(),
            "live_products": obj.products.filter(status="live").count(),
        }


class AdminProductSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source="vendor.shop_name", read_only=True)
    vendor_slug = serializers.CharField(source="vendor.slug", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    image = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id", "slug", "title", "image", "vendor_name", "vendor_slug",
            "category_name", "price", "stock", "status", "sold_count", "created_at",
        ]

    def get_image(self, obj) -> str | None:
        first = obj.images.first()
        return absolute(self.context.get("request"), first.display_url) if first else None


class AdminOrderSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.full_name", read_only=True)
    customer_phone = serializers.CharField(source="customer.phone", read_only=True)
    parcels = serializers.SerializerMethodField()
    status = serializers.CharField(source="derived_status", read_only=True)

    class Meta:
        model = Order
        fields = [
            "order_number", "customer_name", "customer_phone", "created_at",
            "payment_method", "payment_status", "grand_total", "status", "parcels",
        ]

    def get_parcels(self, obj) -> list[dict]:
        return [
            {
                "id": parcel.id,
                "sub_number": parcel.sub_number,
                "vendor": parcel.vendor.shop_name,
                "status": parcel.status,
                "subtotal": parcel.subtotal,
                "commission": parcel.commission_amount,
                "payable": parcel.payable,
            }
            for parcel in obj.vendor_orders.all()
        ]


class AdminPayoutSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source="vendor.shop_name", read_only=True)
    vendor_slug = serializers.CharField(source="vendor.slug", read_only=True)
    entry_count = serializers.SerializerMethodField()

    class Meta:
        model = Payout
        fields = [
            "id", "vendor_name", "vendor_slug", "amount", "status", "method",
            "reference", "entry_count", "created_at", "paid_at",
        ]

    def get_entry_count(self, obj) -> int:
        return obj.entries.count()
