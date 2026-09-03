from django.contrib import admin
from django.utils import timezone

from .models import LedgerEntry, Payout


@admin.register(LedgerEntry)
class LedgerEntryAdmin(admin.ModelAdmin):
    list_display = ["created_at", "vendor", "kind", "amount", "order_number",
                    "release_at", "payout"]
    list_filter = ["kind", "vendor"]
    search_fields = ["vendor__shop_name", "vendor_order__sub_number", "note"]
    readonly_fields = ["vendor", "vendor_order", "kind", "amount"]


@admin.register(Payout)
class PayoutAdmin(admin.ModelAdmin):
    list_display = ["vendor", "amount", "status", "method", "created_at", "paid_at"]
    list_filter = ["status", "vendor"]
    search_fields = ["vendor__shop_name", "reference"]
    actions = ["mark_paid"]

    @admin.action(description="পরিশোধিত হিসেবে চিহ্নিত করুন")
    def mark_paid(self, request, queryset):
        updated = queryset.update(status=Payout.Status.PAID, paid_at=timezone.now())
        self.message_user(request, f"{updated}টি পে-আউট পরিশোধিত হিসেবে চিহ্নিত হলো।")
