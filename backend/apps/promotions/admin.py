from django.contrib import admin

from .models import Coupon


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ["code", "type", "value", "min_order", "max_discount",
                    "vendor", "used_count", "usage_limit", "is_active"]
    list_filter = ["type", "is_active", "vendor"]
    search_fields = ["code", "label"]
