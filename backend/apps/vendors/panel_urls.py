"""ভেন্ডর প্যানেলের রুট — সব /api/v1/vendor/ এর নিচে।"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .panel import (
    VendorApplicationView, VendorBalanceView, VendorLedgerView,
    VendorOrderViewSet, VendorPayoutViewSet, VendorProductViewSet, VendorStatsView,
)

router = DefaultRouter()
router.register("products", VendorProductViewSet, basename="vendor-product")
router.register("orders", VendorOrderViewSet, basename="vendor-order")
router.register("payouts", VendorPayoutViewSet, basename="vendor-payout")

urlpatterns = [
    # অনুমোদনের অপেক্ষায় থাকা বিক্রেতাও এটা ব্যবহার করতে পারেন
    path("application/", VendorApplicationView.as_view(), name="vendor-application"),
    path("stats/", VendorStatsView.as_view(), name="vendor-stats"),
    path("ledger/", VendorLedgerView.as_view(), name="vendor-ledger"),
    path("balance/", VendorBalanceView.as_view(), name="vendor-balance"),
    path("", include(router.urls)),
]
