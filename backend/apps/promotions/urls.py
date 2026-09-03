from django.urls import path

from .views import ValidateCouponView

urlpatterns = [
    path("coupons/validate/", ValidateCouponView.as_view(), name="coupon-validate"),
]
