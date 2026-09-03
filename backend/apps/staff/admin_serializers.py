"""
অ্যাডমিন প্যানেলের CRUD সিরিয়ালাইজার — ক্যাটাগরি, কুপন, ব্যানার, ইউজার।

এগুলো আলাদা ফাইলে রাখা হয়েছে কারণ serializers.py-তে শুধু "দেখার" জন্য
সিরিয়ালাইজার — এখানে লেখার জন্যও।
"""

from rest_framework import serializers

from apps.accounts.models import User
from apps.catalog.models import Banner, Category
from apps.promotions.models import Coupon
from apps.vendors.models import Vendor
from common.serializers import absolute
from common.utils import unique_slug


class AdminCategorySerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source="parent.name", read_only=True, default="")
    product_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = [
            "id", "name", "slug", "icon", "parent", "parent_name",
            "sort_order", "is_active", "product_count",
        ]
        extra_kwargs = {"slug": {"required": False, "allow_blank": True}}

    def get_product_count(self, obj):
        return obj.products.count()

    def validate(self, attrs):
        # নিজেকে নিজের প্যারেন্ট বানানো যাবে না — অসীম লুপ হবে
        parent = attrs.get("parent")
        if parent and self.instance and parent.pk == self.instance.pk:
            raise serializers.ValidationError(
                {"parent": "একটি ক্যাটাগরি নিজেই নিজের উপরের ধাপ হতে পারে না।"}
            )
        return attrs

    def create(self, validated):
        if not validated.get("slug"):
            validated["slug"] = unique_slug(Category, validated["name"], fallback="category")
        return super().create(validated)


class AdminCouponSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source="vendor.shop_name", read_only=True, default="")
    scope = serializers.SerializerMethodField()

    class Meta:
        model = Coupon
        fields = [
            "id", "code", "label", "type", "value", "min_order", "max_discount",
            "vendor", "vendor_name", "scope", "expires_at", "usage_limit",
            "used_count", "is_active", "created_at",
        ]
        read_only_fields = ["used_count", "created_at"]

    def get_scope(self, obj):
        return "vendor" if obj.vendor_id else "platform"

    def validate_code(self, value):
        code = value.strip().upper()
        existing = Coupon.objects.filter(code__iexact=code)
        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError("এই কোডটি আগেই ব্যবহার হয়েছে।")
        return code

    def validate(self, attrs):
        kind = attrs.get("type", getattr(self.instance, "type", Coupon.Kind.FLAT))
        value = attrs.get("value", getattr(self.instance, "value", 0))

        if kind == Coupon.Kind.PERCENT and not (0 < value <= 100):
            raise serializers.ValidationError(
                {"value": "শতাংশ ১ থেকে ১০০ এর মধ্যে হতে হবে।"}
            )
        if kind == Coupon.Kind.FLAT and value <= 0:
            raise serializers.ValidationError({"value": "ছাড়ের টাকা শূন্যের বেশি হতে হবে।"})
        return attrs


class AdminBannerSerializer(serializers.ModelSerializer):
    preview = serializers.SerializerMethodField()

    class Meta:
        model = Banner
        fields = [
            "id", "title", "subtitle", "cta", "href", "image", "image_url",
            "preview", "tone", "sort_order", "is_active",
        ]
        extra_kwargs = {"image": {"required": False, "allow_null": True}}

    def get_preview(self, obj):
        return absolute(self.context.get("request"), obj.display_url)


class AdminUserSerializer(serializers.ModelSerializer):
    shop_name = serializers.SerializerMethodField()
    order_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "full_name", "phone", "email", "role", "is_active",
            "is_phone_verified", "is_staff", "shop_name", "order_count", "date_joined",
        ]
        read_only_fields = fields

    def get_shop_name(self, obj):
        vendor = getattr(obj, "vendor", None)
        return vendor.shop_name if vendor else ""

    def get_order_count(self, obj):
        cached = getattr(obj, "orders_total", None)
        return cached if cached is not None else obj.orders.count()


class VendorOptionSerializer(serializers.ModelSerializer):
    """কুপন ফর্মের ড্রপডাউনে দোকান বেছে নেওয়ার জন্য হালকা তালিকা।"""

    class Meta:
        model = Vendor
        fields = ["id", "shop_name"]
