import re

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from common.models import TimeStamped

BD_PHONE = re.compile(r"^01[3-9]\d{8}$")


def validate_bd_phone(value):
    if not BD_PHONE.match(str(value or "")):
        raise ValidationError("সঠিক মোবাইল নম্বর দিন (যেমন ০১৭xxxxxxxx)।")


class UserManager(BaseUserManager):
    """ইউজারনেম নয় — মোবাইল নম্বরই এখানে পরিচয়।"""

    def create_user(self, phone, password=None, **extra):
        if not phone:
            raise ValueError("মোবাইল নম্বর ছাড়া অ্যাকাউন্ট খোলা যাবে না।")
        phone = str(phone).replace(" ", "").replace("-", "")
        user = self.model(phone=phone, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, phone, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("role", User.Role.STAFF)
        extra.setdefault("is_phone_verified", True)
        extra.setdefault("full_name", "অ্যাডমিন")
        if not extra.get("is_staff") or not extra.get("is_superuser"):
            raise ValueError("সুপারইউজারের is_staff ও is_superuser সত্য হতে হবে।")
        return self.create_user(phone, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        CUSTOMER = "customer", "ক্রেতা"
        VENDOR = "vendor", "বিক্রেতা"
        STAFF = "staff", "স্টাফ"

    phone = models.CharField(
        "মোবাইল", max_length=14, unique=True, validators=[validate_bd_phone]
    )
    full_name = models.CharField("পুরো নাম", max_length=120)
    email = models.EmailField("ইমেইল", blank=True)
    role = models.CharField(max_length=12, choices=Role.choices, default=Role.CUSTOMER)
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)

    is_phone_verified = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "phone"
    REQUIRED_FIELDS = ["full_name"]

    class Meta:
        verbose_name = "ইউজার"
        verbose_name_plural = "ইউজার"
        ordering = ["-date_joined"]

    def __str__(self):
        return f"{self.full_name} ({self.phone})"

    @property
    def is_vendor(self):
        return self.role == self.Role.VENDOR


class Address(TimeStamped):
    """
    ক্রেতার সংরক্ষিত ঠিকানা।

    খেয়াল রাখবেন: অর্ডারে এই রেকর্ডের ForeignKey রাখা হয় না — অর্ডারের সময়
    ঠিকানার একটা কপি (snapshot) JSON হিসেবে বসিয়ে দেওয়া হয়। কারণ ক্রেতা পরে
    ঠিকানা বদলালে পুরোনো অর্ডারের ঠিকানা বদলে যাওয়া উচিত নয়।
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="addresses")
    receiver_name = models.CharField("প্রাপকের নাম", max_length=120)
    phone = models.CharField(max_length=14, validators=[validate_bd_phone])
    division = models.CharField("বিভাগ", max_length=40)
    district = models.CharField("জেলা", max_length=40)
    thana = models.CharField("থানা/উপজেলা", max_length=60)
    address_line = models.TextField("বিস্তারিত ঠিকানা")
    note = models.CharField("ডেলিভারি নোট", max_length=200, blank=True)
    is_default = models.BooleanField(default=False)

    class Meta:
        verbose_name = "ঠিকানা"
        verbose_name_plural = "ঠিকানা"
        ordering = ["-is_default", "-created_at"]

    def __str__(self):
        return f"{self.receiver_name} — {self.district}"

    def as_snapshot(self):
        return {
            "receiver_name": self.receiver_name,
            "phone": self.phone,
            "division": self.division,
            "district": self.district,
            "thana": self.thana,
            "address_line": self.address_line,
            "note": self.note,
        }
