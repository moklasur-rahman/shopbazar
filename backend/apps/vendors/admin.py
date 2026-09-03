from django.contrib import admin
from django.utils import timezone
from django.utils.html import format_html, format_html_join

from .models import Vendor, VendorKYC


_SLOT = "display:inline-block;width:170px;margin:0 12px 8px 0;text-align:center;vertical-align:top"


def _thumb(image, label):
    """অ্যাডমিনে একটা কাগজের থাম্বনেইল — না থাকলেও একই মাপের খালি ঘর।"""
    if not image:
        return format_html(
            '<div style="{}">'
            '<div style="height:120px;border:1px dashed #ccc;border-radius:6px;'
            'display:flex;align-items:center;justify-content:center;color:#aaa;'
            'font-size:12px;background:#fafafa">দেওয়া হয়নি</div>'
            '<div style="font-size:11px;color:#888;margin-top:4px">{}</div></div>',
            _SLOT, label,
        )
    return format_html(
        '<div style="{}">'
        '<a href="{}" target="_blank" rel="noopener" title="পূর্ণ আকারে দেখুন">'
        '<img src="{}" style="height:120px;width:100%;border:1px solid #ddd;'
        'border-radius:6px;object-fit:cover" alt="{}"></a>'
        '<div style="font-size:11px;color:#555;margin-top:4px">{}</div></div>',
        _SLOT, image.url, image.url, label, label,
    )


class VendorKYCInline(admin.StackedInline):
    """
    অনুমোদন দেওয়ার আগে অ্যাডমিনকে NID-র ছবি দেখতে হয়। ফাইলের লিংক
    দেখে কিছু বোঝা যায় না, তাই এখানে থাম্বনেইল দেখানো হচ্ছে — ক্লিক
    করলে পূর্ণ আকারে খুলবে।
    """

    model = VendorKYC
    extra = 0
    readonly_fields = ["document_preview", "reviewed_at"]
    fields = [
        "document_preview",
        ("nid_number", "reviewed_at"),
        ("nid_front", "nid_back"),
        "trade_license",
        ("bkash_number", "bank_name"),
        ("bank_account_name", "bank_account_number"),
        "review_note",
    ]

    @admin.display(description="জমা দেওয়া কাগজপত্র")
    def document_preview(self, obj):
        if not obj or not obj.pk:
            return "—"
        return format_html_join(
            "",
            "{}",
            (
                (_thumb(obj.nid_front, "NID সামনে"),),
                (_thumb(obj.nid_back, "NID পেছনে"),),
                (_thumb(obj.trade_license, "ট্রেড লাইসেন্স"),),
            ),
        )


@admin.register(Vendor)
class VendorAdmin(admin.ModelAdmin):
    list_display = ["shop_name", "owner", "district", "status", "documents_ready",
                    "is_verified", "commission_rate", "rating_avg"]
    list_filter = ["status", "is_verified", "district"]
    # যেগুলোতে কাজ বাকি সেগুলো আগে: suspended → pending → approved
    # (বর্ণানুক্রমে উল্টো করলেই এই ক্রমটা পাওয়া যায়)
    ordering = ["-status", "-created_at"]

    @admin.display(description="কাগজপত্র", boolean=True)
    def documents_ready(self, obj):
        kyc = getattr(obj, "kyc", None)
        return bool(kyc and kyc.nid_number and kyc.nid_front and kyc.nid_back)
    search_fields = ["shop_name", "slug", "owner__phone", "owner__full_name"]
    prepopulated_fields = {"slug": ("shop_name",)}
    inlines = [VendorKYCInline]
    actions = ["approve_vendors", "suspend_vendors"]

    @admin.action(description="নির্বাচিত দোকান অনুমোদন করুন")
    def approve_vendors(self, request, queryset):
        updated = queryset.update(status=Vendor.Status.APPROVED, is_verified=True)
        VendorKYC.objects.filter(vendor__in=queryset).update(reviewed_at=timezone.now())
        self.message_user(request, f"{updated}টি দোকান অনুমোদিত হয়েছে।")

    @admin.action(description="নির্বাচিত দোকান স্থগিত করুন")
    def suspend_vendors(self, request, queryset):
        updated = queryset.update(status=Vendor.Status.SUSPENDED)
        self.message_user(request, f"{updated}টি দোকান স্থগিত করা হয়েছে।")
