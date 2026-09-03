from rest_framework import serializers

from .models import Coupon


class CouponSerializer(serializers.ModelSerializer):
    """
    ফ্রন্টএন্ডের checkoutApi.validateCoupon() ঠিক এই ফিল্ডগুলোই পড়ে
    (src/api/services.js দেখুন)।
    """

    vendor = serializers.IntegerField(source="vendor_id", allow_null=True, read_only=True)

    class Meta:
        model = Coupon
        fields = [
            "code", "label", "type", "value", "min_order", "max_discount",
            "vendor", "expires_at", "usage_limit", "used_count",
        ]
