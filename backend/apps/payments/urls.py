from django.urls import path

from .views import (
    PaymentCallbackView, PaymentIpnView, PaymentMethodsView, PaymentStatusView,
    StartPaymentView,
)

urlpatterns = [
    # চেকআউট এটা দেখে ঠিক করে কোন পদ্ধতিগুলো দেখাবে
    path("methods/", PaymentMethodsView.as_view(), name="payment-methods"),
    path("start/", StartPaymentView.as_view(), name="payment-start"),
    path("status/<str:order_number>/", PaymentStatusView.as_view(), name="payment-status"),

    # গেটওয়ে এখানে ফিরে আসে — এগুলো ক্রেতার ব্রাউজার দিয়ে POST হয়
    path("callback/<str:outcome>/", PaymentCallbackView.as_view(), name="payment-callback"),
    # সার্ভার-টু-সার্ভার, ব্রাউজার জড়িত নয়
    path("ipn/", PaymentIpnView.as_view(), name="payment-ipn"),
]
