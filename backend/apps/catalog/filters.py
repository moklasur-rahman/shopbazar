import django_filters as filters

from .models import Product


class ProductFilter(filters.FilterSet):
    """
    ফ্রন্টএন্ড ঠিক এই query param গুলোই পাঠায় (src/pages/Products.jsx দেখুন):
    ?search=&category=&vendor=&min_price=&max_price=&rating=&free_shipping=
    """

    category = filters.CharFilter(field_name="category__slug")
    vendor = filters.CharFilter(method="filter_vendor")
    min_price = filters.NumberFilter(field_name="price", lookup_expr="gte")
    max_price = filters.NumberFilter(field_name="price", lookup_expr="lte")
    rating = filters.NumberFilter(field_name="rating_avg", lookup_expr="gte")
    free_shipping = filters.BooleanFilter(field_name="free_shipping")

    class Meta:
        model = Product
        fields = ["category", "vendor", "min_price", "max_price", "rating", "free_shipping"]

    def filter_vendor(self, queryset, name, value):
        """slug অথবা সংখ্যা — দুইভাবেই ভেন্ডর খোঁজা যায়।"""
        if str(value).isdigit():
            return queryset.filter(vendor_id=int(value))
        return queryset.filter(vendor__slug=value)
