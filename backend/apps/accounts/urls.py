from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AddressViewSet, LoginView, MeView, RefreshView, RegisterView, VerifyOtpView

router = DefaultRouter()
router.register("addresses", AddressViewSet, basename="address")

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("token/", LoginView.as_view(), name="token"),
    path("token/refresh/", RefreshView.as_view(), name="token-refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("otp/verify/", VerifyOtpView.as_view(), name="otp-verify"),
    path("", include(router.urls)),
]
