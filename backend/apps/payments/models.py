"""
পেমেন্টের হিসাব — প্রতিটি চেষ্টার আলাদা রেকর্ড।

কেন Order-এ কয়েকটা কলাম যোগ করে কাজ সারা হলো না
--------------------------------------------------
এক অর্ডারে পেমেন্ট একাধিকবার চেষ্টা হতে পারে — প্রথমবার ব্যালেন্স
কম, দ্বিতীয়বার OTP আসেনি, তৃতীয়বার সফল। Order-এ একটাই
`transaction_id` রাখলে আগের ব্যর্থ চেষ্টাগুলোর কোনো চিহ্ন থাকত না।
তারপর ক্রেতা যদি বলেন "আমার টাকা কেটেছে কিন্তু অর্ডার হয়নি", প্রমাণ
করার কিছু থাকত না।

তাই প্রতিটি চেষ্টা এক একটা সারি, আর গেটওয়ের পুরো উত্তরটা
`gateway_response`-এ জমা থাকে।
"""

from decimal import Decimal

from django.db import models

from apps.orders.models import Order
from common.models import TimeStamped


class PaymentTransaction(TimeStamped):
    class Status(models.TextChoices):
        #: গেটওয়ের পাতায় পাঠানো হয়েছে, ক্রেতা এখনো কিছু করেননি
        INITIATED = "initiated", "শুরু হয়েছে"
        #: টাকা কাটা হয়েছে এবং সার্ভার-সাইড যাচাইও হয়েছে
        SUCCESS = "success", "সফল"
        FAILED = "failed", "ব্যর্থ"
        CANCELLED = "cancelled", "ক্রেতা বাতিল করেছেন"
        #: গেটওয়ে সফল বলেছে কিন্তু যাচাইয়ে টাকার অঙ্ক মেলেনি —
        #: এটাই সবচেয়ে গুরুতর, হাতে দেখতে হবে
        MISMATCH = "mismatch", "অঙ্ক মেলেনি"
        REFUNDED = "refunded", "ফেরত"

    order = models.ForeignKey(Order, on_delete=models.PROTECT, related_name="transactions")

    #: গেটওয়েকে পাঠানো আমাদের নিজস্ব আইডি — প্রতি চেষ্টায় আলাদা হতে
    #: হয়, নইলে SSLCommerz "duplicate transaction" বলে ফিরিয়ে দেয়
    tran_id = models.CharField(max_length=40, unique=True)

    gateway = models.CharField(max_length=20, default="sslcommerz")
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.INITIATED, db_index=True
    )

    #: অর্ডার তৈরির সময়ের অঙ্ক। যাচাইয়ের সময় গেটওয়ের বলা অঙ্কের সাথে
    #: এটাই মেলানো হয় — ক্রেতা ব্রাউজারে দাম বদলে কম টাকা দিলে ধরা পড়ে
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default="BDT")

    #: গেটওয়ে যা ফেরত দেয়
    val_id = models.CharField(max_length=64, blank=True, db_index=True)
    #: bkash / nagad / rocket / VISA — ক্রেতা আসলে কোনটা দিয়ে দিয়েছেন
    card_type = models.CharField(max_length=60, blank=True)
    bank_tran_id = models.CharField(max_length=80, blank=True)

    #: গেটওয়ের পুরো উত্তর — বিরোধ হলে এটাই একমাত্র প্রমাণ
    gateway_response = models.JSONField(default=dict, blank=True)
    error_reason = models.CharField(max_length=255, blank=True)

    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "পেমেন্ট লেনদেন"
        verbose_name_plural = "পেমেন্ট লেনদেন"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["order", "status"])]

    def __str__(self):
        return f"{self.tran_id} · {self.get_status_display()}"

    @property
    def is_settled(self):
        return self.status == self.Status.SUCCESS

    def amount_matches(self, gateway_amount) -> bool:
        """
        গেটওয়ের বলা অঙ্ক আর আমাদের অঙ্ক এক কি না।

        SSLCommerz দশমিকসহ স্ট্রিং পাঠায় ("1250.00"), আর ভাসমান
        সংখ্যায় তুলনা করলে ০.০১ পয়সার গরমিলে মিথ্যা "মেলেনি" আসতে
        পারত। তাই Decimal-এ এনে ১ পয়সার সহনশীলতা রাখা হয়েছে।
        """
        try:
            given = Decimal(str(gateway_amount))
        except (TypeError, ValueError, ArithmeticError):
            return False
        return abs(given - self.amount) <= Decimal("0.01")
