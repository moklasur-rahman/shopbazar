from django.contrib import admin

from .models import PaymentTransaction


@admin.register(PaymentTransaction)
class PaymentTransactionAdmin(admin.ModelAdmin):
    """
    শুধু দেখার জন্য। পেমেন্টের রেকর্ড হাতে বদলানোর কোনো বৈধ কারণ নেই —
    বদলালে ডেটাবেস আর গেটওয়ের হিসাব আলাদা হয়ে যাবে, আর বিরোধের সময়
    কোনটা সত্যি বোঝা যাবে না।
    """

    list_display = ("tran_id", "order", "status", "amount", "card_type", "paid_at")
    list_filter = ("status", "gateway", "card_type")
    search_fields = ("tran_id", "val_id", "bank_tran_id", "order__order_number")
    readonly_fields = [f.name for f in PaymentTransaction._meta.fields]
    ordering = ("-created_at",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
