from django.contrib import admin

from .models import Order, OrderItem, VendorOrder


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ["product_title", "unit_price", "quantity", "options"]
    can_delete = False


class VendorOrderInline(admin.TabularInline):
    model = VendorOrder
    extra = 0
    readonly_fields = ["sub_number", "vendor", "subtotal", "discount",
                       "shipping_fee", "commission_amount", "payable"]
    show_change_link = True


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ["order_number", "customer", "grand_total", "payment_method",
                    "payment_status", "created_at"]
    list_filter = ["payment_status", "payment_method", "created_at"]
    search_fields = ["order_number", "customer__phone", "customer__full_name"]
    readonly_fields = ["order_number", "items_total", "shipping_total",
                       "discount_total", "grand_total", "shipping_address"]
    inlines = [VendorOrderInline]


@admin.register(VendorOrder)
class VendorOrderAdmin(admin.ModelAdmin):
    list_display = ["sub_number", "vendor", "status", "subtotal",
                    "commission_amount", "payable", "settled", "created_at"]
    list_filter = ["status", "settled", "vendor"]
    search_fields = ["sub_number", "order__order_number", "vendor__shop_name"]
    inlines = [OrderItemInline]
    readonly_fields = ["order", "vendor", "sub_number", "subtotal", "discount",
                       "shipping_fee", "commission_amount", "payable"]
