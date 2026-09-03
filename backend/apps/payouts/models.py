"""
ভেন্ডরের টাকার হিসাব।

নীতি: ভেন্ডরের ব্যালেন্স কোনো কলামে রাখা হয় না। প্রতিটা লেনদেন
LedgerEntry হিসেবে বসে (বিক্রি +, কমিশন −, রিফান্ড −), আর ব্যালেন্স =
সব এন্ট্রির যোগফল।

কেন? ব্যালেন্স কলাম রাখলে একটা বাগেই হিসাব চিরতরে ভুল হয়ে যায় এবং কেউ
ধরতে পারে না। লেজারে প্রতিটা টাকার উৎস খুঁজে বের করা যায় — আর পে-আউট
দেওয়ার সময় এন্ট্রিগুলোতে payout বসিয়ে দিলে দুইবার টাকা দেওয়াও অসম্ভব।
"""

from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import Sum
from django.utils import timezone

from apps.vendors.models import Vendor
from common.models import TimeStamped


class Payout(TimeStamped):
    class Status(models.TextChoices):
        REQUESTED = "requested", "অনুরোধ করা হয়েছে"
        PROCESSING = "processing", "প্রক্রিয়াধীন"
        PAID = "paid", "পরিশোধিত"
        FAILED = "failed", "ব্যর্থ"

    vendor = models.ForeignKey(Vendor, on_delete=models.PROTECT, related_name="payouts")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.PROCESSING
    )
    method = models.CharField(max_length=80, blank=True)
    reference = models.CharField(max_length=80, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "পে-আউট"
        verbose_name_plural = "পে-আউট"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.vendor.shop_name} — ৳{self.amount}"


class LedgerEntry(TimeStamped):
    class Kind(models.TextChoices):
        SALE = "sale", "বিক্রি"
        COMMISSION = "commission", "কমিশন"
        REFUND = "refund", "রিফান্ড"
        ADJUSTMENT = "adjustment", "সমন্বয়"

    vendor = models.ForeignKey(Vendor, on_delete=models.PROTECT, related_name="ledger")
    vendor_order = models.ForeignKey(
        "orders.VendorOrder", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="ledger_entries",
    )
    kind = models.CharField(max_length=12, choices=Kind.choices)
    #: ধনাত্মক = ভেন্ডর পাবে, ঋণাত্মক = কাটা যাবে
    amount = models.DecimalField(max_digits=12, decimal_places=2)

    #: এই সময়ের পর টাকাটা তোলার জন্য খুলে যায় (রিটার্ন উইন্ডো শেষ)
    release_at = models.DateTimeField(null=True, blank=True)

    payout = models.ForeignKey(
        Payout, on_delete=models.SET_NULL, null=True, blank=True, related_name="entries"
    )
    note = models.CharField(max_length=200, blank=True)

    class Meta:
        verbose_name = "লেজার এন্ট্রি"
        verbose_name_plural = "লেজার এন্ট্রি"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_kind_display()} — ৳{self.amount}"

    @property
    def is_released(self):
        return self.release_at is not None and self.release_at <= timezone.now()

    @property
    def order_number(self):
        return self.vendor_order.sub_number if self.vendor_order else ""

    @classmethod
    def hold_until(cls):
        days = settings.MARKETPLACE["PAYOUT_HOLD_DAYS"]
        return timezone.now() + timedelta(days=days)

    @classmethod
    def available_balance(cls, vendor):
        """তোলা যাবে এমন টাকা: হোল্ড শেষ, আর এখনো কোনো পে-আউটে যায়নি।"""
        total = cls.objects.filter(
            vendor=vendor, payout__isnull=True, release_at__lte=timezone.now()
        ).aggregate(total=Sum("amount"))["total"]
        return total or Decimal("0")

    @classmethod
    def on_hold_balance(cls, vendor):
        """এখনো হোল্ডে আছে — রিটার্নের সময় পার হয়নি।"""
        total = cls.objects.filter(
            vendor=vendor, payout__isnull=True, release_at__gt=timezone.now()
        ).aggregate(total=Sum("amount"))["total"]
        return total or Decimal("0")
