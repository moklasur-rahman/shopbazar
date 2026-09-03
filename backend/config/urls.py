"""
API-র সব পথ এখানে জোড়া লাগে।

ফ্রন্টএন্ডের src/api/endpoints.js ফাইলটাই এই তালিকার আয়না —
ওখানে যা যা আছে, এখানে তার প্রত্যেকটার জন্য একটা করে ভিউ আছে।
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView,
)

# ---------------------------------------------------------------- অ্যাডমিন

# অ্যাডমিনের ঠিকানা .env থেকে আসে। ডিফল্ট Django-র `/admin/` সবাই জানে,
# তাই বট দিনরাত ওখানে পাসওয়ার্ড আন্দাজ করার চেষ্টা করে। লাইভে গিয়ে
# .env-এ অনুমান করা কঠিন একটা পাথ দিলে ওই ঝামেলা অনেকটাই কমে।
ADMIN_URL = settings.ADMIN_URL

admin.site.site_header = "শপবাজার প্রশাসন"
admin.site.site_title = "শপবাজার প্রশাসন"
admin.site.index_title = "মার্কেটপ্লেস ব্যবস্থাপনা"


def api_root(_request):
    """ব্যাকএন্ড চলছে কি না দেখার সহজ উপায়।"""
    return JsonResponse(
        {
            "name": "শপবাজার API",
            "version": "v1",
            "docs": "/api/docs/  (Swagger UI) · /api/redoc/  · /api/schema/",
            # DEBUG-এ ঠিকানাটা দেখানো হয় সুবিধার জন্য; লাইভে লুকানো থাকে
            "admin": f"/{ADMIN_URL}" if settings.DEBUG else None,
        },
        json_dumps_params={"ensure_ascii": False},
    )


api_v1 = [
    path("auth/", include("apps.accounts.urls")),
    path("catalog/", include("apps.catalog.urls")),
    path("vendors/", include("apps.vendors.urls")),
    path("promotions/", include("apps.promotions.urls")),
    path("", include("apps.orders.urls")),               # /checkout/ ও /orders/
    path("vendor/", include("apps.vendors.panel_urls")),  # ভেন্ডর প্যানেল
    path("admin/", include("apps.staff.urls")),           # প্ল্যাটফর্ম অ্যাডমিন
]

urlpatterns = [
    path("", api_root),
    path(ADMIN_URL, admin.site.urls),

    # API ডকুমেন্টেশন — ব্রাউজারে খুলে সরাসরি এন্ডপয়েন্ট পরীক্ষা করা যায়
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),

    path("api/v1/", include(api_v1)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
