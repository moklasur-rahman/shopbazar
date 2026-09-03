"""প্ল্যাটফর্ম অ্যাডমিনের রুট — সব /api/v1/admin/ এর নিচে।"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .crud import (
    AdminBannerViewSet, AdminCategoryViewSet, AdminCouponViewSet,
    AdminSettingsView, AdminUserActionView, AdminUserListView,
)
from .reports import ExportView, ProductReportView, SalesReportView, VendorReportView
from .views import (
    AdminOrderListView, AdminPayoutActionView, AdminPayoutListView,
    AdminProductActionView, AdminProductListView, AdminStatsView,
    AdminVendorActionView, AdminVendorDetailView, AdminVendorListView,
)

router = DefaultRouter()
router.register("categories", AdminCategoryViewSet, basename="admin-category")
router.register("coupons", AdminCouponViewSet, basename="admin-coupon")
router.register("banners", AdminBannerViewSet, basename="admin-banner")

urlpatterns = [
    path("stats/", AdminStatsView.as_view(), name="admin-stats"),
    path("settings/", AdminSettingsView.as_view(), name="admin-settings"),

    # দোকান
    path("vendors/", AdminVendorListView.as_view(), name="admin-vendors"),
    path("vendors/<int:pk>/", AdminVendorDetailView.as_view(), name="admin-vendor"),
    path("vendors/<int:pk>/<slug:action>/", AdminVendorActionView.as_view(),
         name="admin-vendor-action"),

    # পণ্য
    path("products/", AdminProductListView.as_view(), name="admin-products"),
    path("products/<int:pk>/<slug:action>/", AdminProductActionView.as_view(),
         name="admin-product-action"),

    # অর্ডার
    path("orders/", AdminOrderListView.as_view(), name="admin-orders"),

    # পে-আউট
    path("payouts/", AdminPayoutListView.as_view(), name="admin-payouts"),
    path("payouts/<int:pk>/<slug:action>/", AdminPayoutActionView.as_view(),
         name="admin-payout-action"),

    # ইউজার
    path("users/", AdminUserListView.as_view(), name="admin-users"),
    path("users/<int:pk>/<slug:action>/", AdminUserActionView.as_view(),
         name="admin-user-action"),

    # রিপোর্ট
    path("reports/sales/", SalesReportView.as_view(), name="admin-report-sales"),
    path("reports/vendors/", VendorReportView.as_view(), name="admin-report-vendors"),
    path("reports/products/", ProductReportView.as_view(), name="admin-report-products"),
    path("reports/export/", ExportView.as_view(), name="admin-report-export"),

    # ক্যাটাগরি, কুপন, ব্যানার (CRUD)
    path("", include(router.urls)),
]
