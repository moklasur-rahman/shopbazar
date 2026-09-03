from decimal import Decimal

from django.conf import settings
from django.db import models

from common.models import TimeStamped
from common.validators import validate_image_file


class Vendor(TimeStamped):
    class Status(models.TextChoices):
        PENDING = "pending", "অপেক্ষমাণ"
        APPROVED = "approved", "অনুমোদিত"
        SUSPENDED = "suspended", "স্থগিত"

    owner = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="vendor"
    )
    shop_name = models.CharField("দোকানের নাম", max_length=120)
    slug = models.SlugField(max_length=140, unique=True)
    district = models.CharField("জেলা", max_length=40, blank=True)

    logo = models.ImageField(upload_to="shops/", blank=True, null=True)
    logo_url = models.URLField(blank=True, max_length=500)
    banner = models.ImageField(upload_to="shops/", blank=True, null=True)
    banner_url = models.URLField(blank=True, max_length=500)

    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    is_verified = models.BooleanField("যাচাই করা", default=False)

    commission_rate = models.DecimalField(
        "কমিশন (%)", max_digits=5, decimal_places=2,
        default=settings.MARKETPLACE["DEFAULT_COMMISSION_RATE"],
        help_text="খালি রাখলে ক্যাটাগরির হার প্রযোজ্য হবে।",
    )
    ships_in_days = models.PositiveSmallIntegerField("কত দিনে পাঠায়", default=2)
    response_rate = models.PositiveSmallIntegerField("রেসপন্স রেট (%)", default=90)

    # রিভিউ থেকে হিসাব করে রাখা হয়, প্রতিবার গোনা হয় না
    rating_avg = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal("0"))
    rating_count = models.PositiveIntegerField(default=0)

    pickup_address = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = "দোকান"
        verbose_name_plural = "দোকান"
        ordering = ["-rating_avg", "shop_name"]

    def __str__(self):
        return self.shop_name

    @property
    def logo_display(self):
        return self.logo.url if self.logo else (self.logo_url or None)

    @property
    def banner_display(self):
        return self.banner.url if self.banner else (self.banner_url or None)

    @property
    def is_approved(self):
        return self.status == self.Status.APPROVED

    def commission_for(self, category_slug=None):
        """
        এই দোকানের জন্য কার্যকর কমিশনের হার।

        দোকানে নিজস্ব হার বসানো থাকলে সেটাই চলে (বড় বিক্রেতার সাথে আলাদা
        চুক্তি হতে পারে); নাহলে ক্যাটাগরির হার, তাও না পেলে ডিফল্ট।
        """
        rules = settings.MARKETPLACE
        if self.commission_rate:
            return self.commission_rate
        return rules["COMMISSION_BY_CATEGORY"].get(
            category_slug, rules["DEFAULT_COMMISSION_RATE"]
        )


class VendorKYC(TimeStamped):
    """
    পরিচয় যাচাইয়ের কাগজপত্র।

    আলাদা মডেলে রাখা হয়েছে কারণ এতে স্পর্শকাতর তথ্য থাকে — পরে চাইলে
    আলাদা পারমিশন বা এনক্রিপশন বসানো সহজ হবে।
    """

    vendor = models.OneToOneField(Vendor, on_delete=models.CASCADE, related_name="kyc")
    nid_number = models.CharField("NID নম্বর", max_length=25, blank=True)
    nid_front = models.ImageField(
        "NID সামনের দিক", upload_to="kyc/%Y/%m/", blank=True, null=True,
        validators=[validate_image_file],
    )
    nid_back = models.ImageField(
        "NID পেছনের দিক", upload_to="kyc/%Y/%m/", blank=True, null=True,
        validators=[validate_image_file],
    )
    trade_license = models.ImageField(
        "ট্রেড লাইসেন্স", upload_to="kyc/%Y/%m/", blank=True, null=True,
        validators=[validate_image_file],
    )

    bkash_number = models.CharField("বিকাশ নম্বর", max_length=14, blank=True)
    bank_name = models.CharField(max_length=80, blank=True)
    bank_account_name = models.CharField(max_length=120, blank=True)
    bank_account_number = models.CharField(max_length=40, blank=True)

    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_note = models.CharField(max_length=250, blank=True)

    class Meta:
        verbose_name = "KYC"
        verbose_name_plural = "KYC"

    def __str__(self):
        return f"{self.vendor.shop_name} — KYC"

    @property
    def payout_target(self):
        """টাকা কোথায় পাঠানো হবে — বিকাশ অগ্রাধিকার পায়।"""
        if self.bkash_number:
            masked = self.bkash_number[:5] + "******"
            return f"বিকাশ {masked}"
        if self.bank_account_number:
            return f"ব্যাংক — {self.bank_name}"
        return "নির্ধারিত হয়নি"
