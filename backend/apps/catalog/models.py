from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import Avg, Count

from apps.vendors.models import Vendor
from common.models import TimeStamped


class Category(TimeStamped):
    """
    ক্যাটাগরি প্ল্যাটফর্মের, ভেন্ডরের নয় — অ্যাডমিন ঠিক করে দেন।
    নাহলে প্রতিটি দোকান নিজের মতো নাম দিলে ফিল্টার অর্থহীন হয়ে যায়।
    """

    parent = models.ForeignKey(
        "self", on_delete=models.CASCADE, null=True, blank=True, related_name="children"
    )
    name = models.CharField("নাম", max_length=80)
    slug = models.SlugField(max_length=90, unique=True)
    icon = models.CharField("আইকন (ইমোজি)", max_length=8, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "ক্যাটাগরি"
        verbose_name_plural = "ক্যাটাগরি"
        ordering = ["sort_order", "name"]

    def __str__(self):
        return self.name


class Brand(TimeStamped):
    name = models.CharField(max_length=80)
    slug = models.SlugField(max_length=90, unique=True)

    class Meta:
        verbose_name = "ব্র্যান্ড"
        verbose_name_plural = "ব্র্যান্ড"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Product(TimeStamped):
    class Status(models.TextChoices):
        DRAFT = "draft", "খসড়া"
        PENDING = "pending", "অনুমোদনের অপেক্ষায়"
        LIVE = "live", "সচল"
        REJECTED = "rejected", "বাতিল"

    vendor = models.ForeignKey(Vendor, on_delete=models.CASCADE, related_name="products")
    category = models.ForeignKey(
        Category, on_delete=models.PROTECT, related_name="products"
    )
    brand = models.ForeignKey(
        Brand, on_delete=models.SET_NULL, null=True, blank=True, related_name="products"
    )

    title = models.CharField("নাম", max_length=200)
    slug = models.SlugField(max_length=220, unique=True)
    description = models.TextField("বিবরণ", blank=True)
    specs = models.JSONField("স্পেসিফিকেশন", default=dict, blank=True)

    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    free_shipping = models.BooleanField(default=False)

    # ---- ভ্যারিয়েন্ট থেকে হিসাব করে রাখা ফিল্ড ----
    # দাম ও স্টকের আসল উৎস ProductVariant। কিন্তু ফিল্টার আর সর্টিং
    # (?min_price=, ?ordering=price) SQL-এ করতে হলে কলাম দরকার, তাই
    # sync_from_variants() দিয়ে এগুলো সবসময় মিলিয়ে রাখা হয়।
    price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    compare_at_price = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    stock = models.PositiveIntegerField(default=0)

    rating_avg = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal("0"))
    rating_count = models.PositiveIntegerField(default=0)
    sold_count = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "পণ্য"
        verbose_name_plural = "পণ্য"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["price"]),
        ]

    def __str__(self):
        return self.title

    @property
    def is_live(self):
        return self.status == self.Status.LIVE and self.vendor.is_approved

    def sync_from_variants(self):
        """
        ভ্যারিয়েন্ট বদলালে প্রোডাক্টের দাম/স্টক মিলিয়ে দেয়।
        update() ব্যবহার করা হয়েছে যাতে save() আবার না ডাকে (অসীম লুপ এড়াতে)।
        """
        variants = list(self.variants.all())
        if not variants:
            return

        cheapest = min(variants, key=lambda v: v.price)
        total_stock = sum(v.stock for v in variants)

        Product.objects.filter(pk=self.pk).update(
            price=cheapest.price,
            compare_at_price=cheapest.compare_at_price,
            stock=total_stock,
        )
        self.price = cheapest.price
        self.compare_at_price = cheapest.compare_at_price
        self.stock = total_stock

    def refresh_rating(self):
        stats = self.reviews.aggregate(avg=Avg("rating"), total=Count("id"))
        Product.objects.filter(pk=self.pk).update(
            rating_avg=round(stats["avg"] or 0, 2),
            rating_count=stats["total"] or 0,
        )


class ProductImage(TimeStamped):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="products/", blank=True, null=True)
    image_url = models.URLField(blank=True, max_length=500)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        verbose_name = "পণ্যের ছবি"
        verbose_name_plural = "পণ্যের ছবি"
        ordering = ["sort_order", "id"]

    def __str__(self):
        return f"{self.product.title} — ছবি {self.sort_order + 1}"

    @property
    def display_url(self):
        return self.image.url if self.image else (self.image_url or None)


class ProductVariant(TimeStamped):
    """
    দাম আর স্টক সবসময় এখানে থাকে, প্রোডাক্টে নয়।

    ভ্যারিয়েন্ট না থাকলেও একটা ডিফল্ট বানানো হয় (options খালি) — এতে
    "সাইজ আছে" আর "সাইজ নেই" দুই ধরনের পণ্যের কোড আলাদা করতে হয় না।
    """

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="variants")
    sku = models.CharField(max_length=60, unique=True)
    options = models.JSONField(default=dict, blank=True, help_text='যেমন {"সাইজ": "M", "রঙ": "কালো"}')

    price = models.DecimalField(max_digits=12, decimal_places=2)
    compare_at_price = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    stock = models.PositiveIntegerField(default=0)
    weight_kg = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0.5"))

    class Meta:
        verbose_name = "ভ্যারিয়েন্ট"
        verbose_name_plural = "ভ্যারিয়েন্ট"
        ordering = ["id"]

    def __str__(self):
        label = ", ".join(f"{k}: {v}" for k, v in (self.options or {}).items())
        return f"{self.product.title} ({label})" if label else self.product.title

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self.product.sync_from_variants()


class Review(TimeStamped):
    """
    রিভিউ OrderItem-এর সাথে বাঁধা — অর্থাৎ যে কিনেছে সে-ই কেবল লিখতে পারে।
    order_item খালি রাখা যায় শুধু সিড ডেটার জন্য।
    """

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="reviews")
    order_item = models.OneToOneField(
        "orders.OrderItem", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="review",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="reviews",
    )
    author_name = models.CharField(max_length=120, blank=True)
    rating = models.PositiveSmallIntegerField()
    comment = models.TextField(blank=True)
    is_verified_purchase = models.BooleanField(default=False)

    class Meta:
        verbose_name = "রিভিউ"
        verbose_name_plural = "রিভিউ"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.product.title} — {self.rating}★"

    def display_author(self):
        return self.author_name or (self.author.full_name if self.author else "ক্রেতা")


class ReviewPhoto(TimeStamped):
    review = models.ForeignKey(Review, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to="reviews/", blank=True, null=True)
    image_url = models.URLField(blank=True, max_length=500)

    @property
    def display_url(self):
        return self.image.url if self.image else (self.image_url or None)


class Banner(TimeStamped):
    """হোম পেজের হিরো স্লাইডার।"""

    TONES = [("brand", "সবুজ"), ("dark", "গাঢ়"), ("accent", "সোনালি")]

    title = models.CharField(max_length=120)
    subtitle = models.CharField(max_length=200, blank=True)
    cta = models.CharField("বোতামের লেখা", max_length=40, default="দেখুন")
    href = models.CharField("লিংক", max_length=200, default="/products")
    image = models.ImageField(upload_to="banners/", blank=True, null=True)
    image_url = models.URLField(blank=True, max_length=500)
    tone = models.CharField(max_length=10, choices=TONES, default="brand")
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "ব্যানার"
        verbose_name_plural = "ব্যানার"
        ordering = ["sort_order", "id"]

    def __str__(self):
        return self.title

    @property
    def display_url(self):
        return self.image.url if self.image else (self.image_url or None)
