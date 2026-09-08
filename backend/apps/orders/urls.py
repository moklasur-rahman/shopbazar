from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CancelVendorOrderView, OrderViewSet, QuoteView, TrackOrderView

router = DefaultRouter()
router.register("orders", OrderViewSet, basename="order")

urlpatterns = [
    path("checkout/quote/", QuoteView.as_view(), name="checkout-quote"),
    # ⚠️ router-এর আগে থাকতে হবে, নইলে "track" কে অর্ডার নম্বর ধরে
    # OrderViewSet-এর detail রুটে চলে যেত (lookup regex "[^/]+")
    path("orders/track/", TrackOrderView.as_view(), name="order-track"),
    path(
        "orders/vendor-orders/<int:pk>/cancel/",
        CancelVendorOrderView.as_view(),
        name="vendor-order-cancel",
    ),
    path("", include(router.urls)),
]
