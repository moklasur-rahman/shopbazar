from decimal import Decimal

from django.db import models
from django.utils import timezone

from apps.vendors.models import Vendor
from common.models import TimeStamped


class Coupon(TimeStamped):
    """
    vendor খালি (null) মানে প্ল্যাটফর্মের কুপন — ছাড়ের টাকা প্ল্যাটফর্ম বহন করে।
    vendor বসানো থাকলে সেটা ওই দোকানের পণ্যেই চলবে এবং খরচ ভেন্ডরের।
    এই একটা ফিল্ডই ঠিক করে দেয় কে টাকাটা হারাচ্ছে।
    """

    class Kind(models.TextChoices):
        FLAT = "flat", "নির্দিষ্ট টাকা"
        PERCENT = "percent", "শতাংশ"

    code = models.CharField("কোড", max_length=32, unique=True)
    label = models.CharField("বর্ণনা", max_length=120, blank=True)
    type = models.CharField(max_length=10, choices=Kind.choices, default=Kind.FLAT)
    value = models.DecimalField("মান", max_digits=10, decimal_places=2)

    min_order = models.DecimalField(
        "সর্বনিম্ন অর্ডার", max_digits=10, decimal_places=2, default=Decimal("0")
    )
    max_discount = models.DecimalField(
        "সর্বোচ্চ ছাড়", max_digits=10, decimal_places=2, null=True, blank=True
    )

    vendor = models.ForeignKey(
        Vendor, on_delete=models.CASCADE, null=True, blank=True, related_name="coupons"
    )

    expires_at = models.DateTimeField(null=True, blank=True)
    usage_limit = models.PositiveIntegerField(null=True, blank=True)
    used_count = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "কুপন"
        verbose_name_plural = "কুপন"
        ordering = ["-created_at"]

    def __str__(self):
        return self.code

    def check_usable(self):
        """ব্যবহার করা যাবে কি না — না গেলে কারণসহ বার্তা ফেরত দেয়।"""
        if not self.is_active:
            return "কুপনটি এখন বন্ধ আছে"
        if self.expires_at and self.expires_at < timezone.now():
            return "কুপনের মেয়াদ শেষ"
        if self.usage_limit is not None and self.used_count >= self.usage_limit:
            return "কুপনের সীমা শেষ হয়ে গেছে"
        return None
