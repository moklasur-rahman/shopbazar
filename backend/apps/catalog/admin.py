from django.contrib import admin

from .models import Banner, Brand, Category, Product, ProductImage, ProductVariant, Review, ReviewPhoto


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1


class ProductVariantInline(admin.TabularInline):
    model = ProductVariant
    extra = 1


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "icon", "parent", "sort_order", "is_active"]
    list_editable = ["sort_order", "is_active"]
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ["name", "slug"]
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ["title", "vendor", "category", "price", "stock", "status", "sold_count"]
    list_filter = ["status", "category", "vendor", "free_shipping"]
    search_fields = ["title", "slug", "vendor__shop_name"]
    prepopulated_fields = {"slug": ("title",)}
    inlines = [ProductImageInline, ProductVariantInline]
    readonly_fields = ["price", "compare_at_price", "stock", "rating_avg", "rating_count"]
    actions = ["approve_products", "unpublish_products"]

    @admin.action(description="নির্বাচিত পণ্য সাইটে প্রকাশ করুন")
    def approve_products(self, request, queryset):
        count = queryset.update(status=Product.Status.LIVE)
        self.message_user(request, f"{count}টি পণ্য প্রকাশিত হয়েছে।")

    @admin.action(description="নির্বাচিত পণ্য সাইট থেকে সরান")
    def unpublish_products(self, request, queryset):
        count = queryset.update(status=Product.Status.DRAFT)
        self.message_user(request, f"{count}টি পণ্য সরানো হয়েছে।")


class ReviewPhotoInline(admin.TabularInline):
    model = ReviewPhoto
    extra = 0


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ["product", "rating", "display_author", "is_verified_purchase", "created_at"]
    list_filter = ["rating", "is_verified_purchase"]
    search_fields = ["product__title", "comment", "author_name"]
    inlines = [ReviewPhotoInline]


@admin.register(Banner)
class BannerAdmin(admin.ModelAdmin):
    list_display = ["title", "tone", "sort_order", "is_active"]
    list_editable = ["sort_order", "is_active"]
