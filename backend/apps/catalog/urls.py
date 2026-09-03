from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import BannerListView, CategoryViewSet, FlashSaleView, ProductViewSet

router = DefaultRouter()
router.register("categories", CategoryViewSet, basename="category")
router.register("products", ProductViewSet, basename="product")

urlpatterns = [
    path("banners/", BannerListView.as_view(), name="banners"),
    path("flash-sale/", FlashSaleView.as_view(), name="flash-sale"),
    path("", include(router.urls)),
]
