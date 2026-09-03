from rest_framework import serializers

from apps.vendors.serializers import VendorBriefSerializer, VendorSerializer
from common.serializers import absolute

from .models import Banner, Category, Product, ProductImage, ProductVariant, Review


class CategoryBriefSerializer(serializers.ModelSerializer):
    """
    পণ্যের ভেতরে নেস্ট করার জন্য — উপ-ক্যাটাগরি ছাড়া।

    পূর্ণ CategorySerializer প্রতিবার `children` আনতে একটা কুয়েরি চালায়।
    পণ্যের তালিকায় প্রতিটি পণ্যের ভেতরে ক্যাটাগরি থাকে, তাই ১২টা পণ্যে
    ১২টা বাড়তি কুয়েরি হয়ে যেত। ফ্রন্টএন্ড পণ্যের ক্যাটাগরি থেকে শুধু
    slug আর name পড়ে, children কখনোই নয়।
    """

    class Meta:
        model = Category
        fields = ["id", "slug", "name", "icon"]


class CategorySerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ["id", "slug", "name", "icon", "children"]

    def get_children(self, obj):
        # ফ্রন্টএন্ড শুধু নামের তালিকা দেখায় (ড্রয়ারে গণনা করতে)।
        # ভিউতে prefetch_related("children") থাকায় এটা বাড়তি কুয়েরি চালায় না।
        return [child.name for child in obj.children.all() if child.is_active]


class ProductVariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductVariant
        fields = ["id", "sku", "options", "price", "compare_at_price", "stock", "weight_kg"]


class ProductImageSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = ProductImage
        fields = ["image"]

    def get_image(self, obj):
        return absolute(self.context.get("request"), obj.display_url)


class ProductSerializer(serializers.ModelSerializer):
    """
    adapters.js → toProduct() এর আয়না। `variants` সবসময় পাঠানো হয়,
    এমনকি একটাই হলেও — ফ্রন্টএন্ড ওখান থেকেই দাম ও স্টক পড়ে।
    """

    images = ProductImageSerializer(many=True, read_only=True)
    variants = ProductVariantSerializer(many=True, read_only=True)
    vendor = VendorSerializer(read_only=True)
    # হালকা সংস্করণ — পণ্যের ভেতরে উপ-ক্যাটাগরির দরকার নেই
    category = CategoryBriefSerializer(read_only=True)
    brand = serializers.CharField(source="brand.name", default="", read_only=True)

    class Meta:
        model = Product
        fields = [
            "id", "slug", "title", "description", "images", "category", "brand",
            "vendor", "variants", "price", "compare_at_price", "stock",
            "rating_avg", "rating_count", "sold_count", "free_shipping",
            "status", "created_at", "specs",
        ]


class ProductListSerializer(ProductSerializer):
    """
    তালিকার জন্য হালকা সংস্করণ — বিবরণ আর স্পেসিফিকেশন বাদ।
    ১২টা পণ্যের পাতায় এতে রেসপন্স প্রায় অর্ধেক হয়ে যায়।

    ভেন্ডরের হালকা সংস্করণও এখানে ব্যবহার হয় — নাহলে প্রতিটি পণ্যের জন্য
    একটা করে বাড়তি COUNT কুয়েরি চলত (N+1)।
    """

    vendor = VendorBriefSerializer(read_only=True)

    class Meta(ProductSerializer.Meta):
        fields = [
            "id", "slug", "title", "images", "category", "vendor", "variants",
            "price", "compare_at_price", "stock", "rating_avg", "rating_count",
            "sold_count", "free_shipping", "status", "created_at",
        ]


class ReviewSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    photos = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = ["id", "rating", "comment", "author_name", "created_at",
                  "is_verified_purchase", "photos"]

    def get_author_name(self, obj):
        return obj.display_author()

    def get_photos(self, obj):
        request = self.context.get("request")
        return [absolute(request, p.display_url) for p in obj.photos.all() if p.display_url]


class BannerSerializer(serializers.ModelSerializer):
    """
    এই রেসপন্স ফ্রন্টএন্ডে কোনো adapter ছাড়াই সরাসরি ব্যবহার হয়,
    তাই ফিল্ডের নাম ঠিক যেমন আছে তেমনই থাকতে হবে।
    """

    image = serializers.SerializerMethodField()

    class Meta:
        model = Banner
        fields = ["id", "title", "subtitle", "cta", "href", "image", "tone"]

    def get_image(self, obj):
        return absolute(self.context.get("request"), obj.display_url)
