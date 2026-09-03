from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CancelVendorOrderView, OrderViewSet, QuoteView

router = DefaultRouter()
router.register("orders", OrderViewSet, basename="order")

urlpatterns = [
    path("checkout/quote/", QuoteView.as_view(), name="checkout-quote"),
    path(
        "orders/vendor-orders/<int:pk>/cancel/",
        CancelVendorOrderView.as_view(),
        name="vendor-order-cancel",
    ),
    path("", include(router.urls)),
]
