from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from common.utils import unique_slug

from .models import Address, User, validate_bd_phone


def tokens_for(user):
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


class VendorStubSerializer(serializers.Serializer):
    """
    ইউজারের সাথে শুধু ভেন্ডরের slug টুকু যায় —
    ফ্রন্টএন্ড এটা দিয়েই "আমার দোকান" লিংক বানায়।
    """

    slug = serializers.CharField()


class UserSerializer(serializers.ModelSerializer):
    vendor = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "full_name", "phone", "email", "role", "avatar", "vendor", "is_staff",
        ]
        # is_staff শুধু পড়া যায় — রেজিস্ট্রেশনে পাঠিয়ে কেউ যেন
        # নিজেকে অ্যাডমিন বানাতে না পারে
        read_only_fields = ["is_staff"]

    def get_vendor(self, obj):
        """
        status টাও পাঠানো হয় — ফ্রন্টএন্ড এটা দেখেই ঠিক করে নতুন বিক্রেতাকে
        ড্যাশবোর্ড দেখাবে নাকি "অনুমোদনের অপেক্ষায়" পাতা। এটা ছাড়া
        pending বিক্রেতা ভাঙা ড্যাশবোর্ডে ঢুকে পড়ত।
        """
        vendor = getattr(obj, "vendor", None)
        if not vendor:
            return None
        return {
            "slug": vendor.slug,
            "shop_name": vendor.shop_name,
            "status": vendor.status,
            "is_verified": vendor.is_verified,
        }

    def get_avatar(self, obj):
        return obj.avatar.url if obj.avatar else None


class LoginSerializer(serializers.Serializer):
    """
    মোবাইল নম্বর + পাসওয়ার্ড দিয়ে লগইন।

    ভুল হলে DRF-এর ফিল্ড-ভিত্তিক এরর ফেরত যায় ({"phone": [...]}),
    কারণ ফ্রন্টএন্ডের client.js ওই আকারটাই পড়ে ইনপুটের নিচে বার্তা দেখায়।
    """

    phone = serializers.CharField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate(self, attrs):
        phone = attrs["phone"].replace(" ", "").replace("-", "")

        if not User.objects.filter(phone=phone).exists():
            raise serializers.ValidationError({"phone": "এই নম্বরে কোনো অ্যাকাউন্ট নেই।"})

        user = authenticate(
            request=self.context.get("request"), username=phone, password=attrs["password"]
        )
        if user is None:
            raise serializers.ValidationError({"password": "পাসওয়ার্ড ভুল হয়েছে।"})
        if not user.is_active:
            raise serializers.ValidationError({"phone": "অ্যাকাউন্টটি বন্ধ করা হয়েছে।"})

        attrs["user"] = user
        return attrs


class RegisterSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=120)
    phone = serializers.CharField(validators=[validate_bd_phone])
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True)
    role = serializers.ChoiceField(
        choices=[User.Role.CUSTOMER, User.Role.VENDOR], default=User.Role.CUSTOMER
    )
    shop_name = serializers.CharField(required=False, allow_blank=True, max_length=120)

    def validate_password(self, value):
        """
        settings.AUTH_PASSWORD_VALIDATORS এখানে হাতে ডাকতে হয়।

        ⚠️ DRF সিরিয়ালাইজার Django-র পাসওয়ার্ড ভ্যালিডেটর নিজে থেকে
        চালায় না — ওগুলো শুধু Django-র নিজের ফর্মে (যেমন admin) চলে।
        এটা না থাকায় API দিয়ে "1234" পাসওয়ার্ডেও অ্যাকাউন্ট খোলা যেত,
        যদিও settings-এ ন্যূনতম ৮ অক্ষর লেখা ছিল।
        """
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages)) from exc
        return value

    def validate_phone(self, value):
        phone = value.replace(" ", "").replace("-", "")
        if User.objects.filter(phone=phone).exists():
            raise serializers.ValidationError("এই নম্বরে আগেই অ্যাকাউন্ট আছে।")
        return phone

    def validate(self, attrs):
        if attrs["role"] == User.Role.VENDOR and not attrs.get("shop_name", "").strip():
            raise serializers.ValidationError({"shop_name": "দোকানের নাম লিখুন।"})
        return attrs

    @transaction.atomic
    def create(self, validated):
        from apps.vendors.models import Vendor  # circular import এড়াতে ভেতরে

        role = validated["role"]
        shop_name = validated.pop("shop_name", "").strip()

        user = User.objects.create_user(
            phone=validated["phone"],
            password=validated["password"],
            full_name=validated["full_name"],
            email=validated.get("email", ""),
            role=role,
        )

        if role == User.Role.VENDOR:
            # নতুন দোকান সবসময় pending — অ্যাডমিন NID দেখে অনুমোদন দেবেন,
            # তার আগে পণ্য সাইটে দেখা যাবে না।
            #
            # বাংলা নাম ASCII slugify-তে খালি হয়ে যায় ("ঢাকা ফ্যাশন" → "")।
            # তখন সবাই "shop", "shop-2" পেত। ফোনের শেষ ৪ ডিজিট জুড়ে দিলে
            # প্রতিটা দোকানের URL আলাদা আর চেনা যায় এমন হয়।
            Vendor.objects.create(
                owner=user,
                shop_name=shop_name,
                slug=unique_slug(
                    Vendor, shop_name, fallback=f"shop-{user.phone[-4:]}"
                ),
                status=Vendor.Status.PENDING,
            )

        return user


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = [
            "id", "receiver_name", "phone", "division", "district",
            "thana", "address_line", "note", "is_default",
        ]

    def create(self, validated):
        validated["user"] = self.context["request"].user
        return super().create(validated)
