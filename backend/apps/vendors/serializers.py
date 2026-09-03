import re

from rest_framework import serializers

from common.serializers import absolute

from .models import Vendor, VendorKYC


class VendorBriefSerializer(serializers.ModelSerializer):
    """
    পণ্যের তালিকার ভেতরে দেখানোর জন্য হালকা সংস্করণ — `product_count` নেই।

    কেন আলাদা? পূর্ণ VendorSerializer প্রতিটি দোকানের পণ্য গুনতে একটা করে
    COUNT কুয়েরি চালায়। ১২টা পণ্যের তালিকায় সেটা ১২টা বাড়তি কুয়েরি হয়ে
    যেত (মোট ২৮টা)। তালিকায় ওই সংখ্যাটা দেখানোই হয় না, তাই বাদ।
    """

    logo = serializers.SerializerMethodField()

    class Meta:
        model = Vendor
        fields = [
            "id", "slug", "shop_name", "logo", "district", "rating_avg",
            "rating_count", "is_verified", "ships_in_days", "commission_rate",
        ]

    def get_logo(self, obj) -> str | None:
        return absolute(self.context.get("request"), obj.logo_display)


class VendorSerializer(serializers.ModelSerializer):
    """
    ফিল্ডের নামগুলো ফ্রন্টএন্ডের src/api/adapters.js → toVendor() এর সাথে
    হুবহু মেলে। এখানে কিছু বদলালে ওই ফাইলটাও বদলাতে হবে।

    তালিকায় নয় — একটামাত্র দোকান বা পণ্যের বিস্তারিত পাতায় ব্যবহার করুন।
    তালিকার জন্য VendorBriefSerializer আছে।
    """

    logo = serializers.SerializerMethodField()
    banner = serializers.SerializerMethodField()
    product_count = serializers.SerializerMethodField()

    class Meta:
        model = Vendor
        fields = [
            "id", "slug", "shop_name", "logo", "banner", "district",
            "rating_avg", "rating_count", "product_count", "is_verified",
            "response_rate", "ships_in_days", "commission_rate", "created_at",
        ]

    def _request(self):
        return self.context.get("request")

    def get_logo(self, obj) -> str | None:
        return absolute(self._request(), obj.logo_display)

    def get_banner(self, obj) -> str | None:
        return absolute(self._request(), obj.banner_display)

    def get_product_count(self, obj) -> int:
        # ভিউতে annotate করা থাকলে সেটাই ব্যবহার হয়, নাহলে গুনে নেওয়া হয়
        cached = getattr(obj, "live_product_count", None)
        if cached is not None:
            return cached
        return obj.products.filter(status="live").count()


class VendorProductWriteSerializer(serializers.Serializer):
    """
    ভেন্ডর প্যানেলের পণ্য ফর্ম ঠিক এই ফিল্ডগুলোই পাঠায়
    (src/api/services.js → vendorPanelApi.saveProduct)।

    `category` স্লাগ হিসেবে আসে (আইডি নয়), আর `images` URL-এর তালিকা।
    ফাইল আপলোড যোগ করলে এখানে ListField(ImageField) বসাতে হবে —
    client.js ইতিমধ্যেই FormData সামলাতে পারে।
    """

    title = serializers.CharField(max_length=200)
    category = serializers.CharField()
    description = serializers.CharField(allow_blank=True, required=False, default="")
    price = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=1)
    compare_at_price = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True
    )
    stock = serializers.IntegerField(min_value=0)
    status = serializers.ChoiceField(
        choices=["draft", "pending", "live"], required=False, default="pending"
    )
    images = serializers.ListField(
        child=serializers.URLField(), required=False, allow_empty=True
    )

    def validate(self, attrs):
        compare_at = attrs.get("compare_at_price")
        if compare_at and compare_at <= attrs["price"]:
            raise serializers.ValidationError(
                {"compare_at_price": "আগের দাম বর্তমান দামের চেয়ে বেশি হতে হবে।"}
            )
        return attrs


class VendorKYCSerializer(serializers.ModelSerializer):
    """
    পরিচয় যাচাইয়ের কাগজপত্র। ছবিগুলো ঐচ্ছিক রাখা হয়েছে যাতে বিক্রেতা
    আগে তথ্য জমা দিয়ে পরে ছবি আপলোড করতে পারেন।
    """

    class Meta:
        model = VendorKYC
        fields = [
            "nid_number", "nid_front", "nid_back", "trade_license",
            "bkash_number", "bank_name", "bank_account_name", "bank_account_number",
            "reviewed_at", "review_note",
        ]
        read_only_fields = ["reviewed_at", "review_note"]
        extra_kwargs = {
            "nid_front": {"required": False, "allow_null": True},
            "nid_back": {"required": False, "allow_null": True},
            "trade_license": {"required": False, "allow_null": True},
        }

    #: এই তিনটা ফাইল ফিল্ড — খালি স্ট্রিং পাঠালে ছবিটা মুছে ফেলা হয়
    IMAGE_FIELDS = ("nid_front", "nid_back", "trade_license")

    def to_internal_value(self, data):
        """
        multipart ফর্মে ফাঁকা ফাইল ইনপুট খালি স্ট্রিং হিসেবে আসে।
        সেটাকে None ধরা হয় — অর্থাৎ "ছবিটা সরিয়ে দাও"।

        ⚠️ এখানে কখনো QueryDict.copy() ব্যবহার করবেন না। ওটা ভেতরের
        ফাইলগুলোরও deepcopy করে, আর ২.৫ MB-র বেশি ফাইল Django
        TemporaryUploadedFile হিসেবে রাখে — যেটা deepcopy করা যায় না
        ("cannot pickle 'BufferedRandom'")। মোবাইলে তোলা NID-র ছবি
        প্রায়ই ৩-৫ MB, তাই ওই পথে গেলে আসল আপলোডই ভেঙে পড়ে।
        নিচের dict comprehension শুধু রেফারেন্স কপি করে, তাই নিরাপদ।
        """
        needs_clear = [
            field
            for field in self.IMAGE_FIELDS
            if isinstance(data.get(field), str)
            and data[field].strip() in ("", "null", "undefined")
        ]

        if needs_clear:
            data = {key: data[key] for key in data}  # shallow — deepcopy নয়
            for field in needs_clear:
                data[field] = None

        return super().to_internal_value(data)

    def validate_bkash_number(self, value):
        if value and not re.match(r"^01[3-9]\d{8}$", value.replace(" ", "").replace("-", "")):
            raise serializers.ValidationError("সঠিক বিকাশ নম্বর দিন (১১ ডিজিট)।")
        return value

    def validate(self, attrs):
        # টাকা কোথায় পাঠানো হবে সেটা না জানলে পে-আউট দেওয়া যাবে না
        instance = self.instance
        bkash = attrs.get("bkash_number", getattr(instance, "bkash_number", ""))
        account = attrs.get(
            "bank_account_number", getattr(instance, "bank_account_number", "")
        )
        if attrs.get("nid_number") and not (bkash or account):
            raise serializers.ValidationError(
                {"bkash_number": "বিকাশ নম্বর বা ব্যাংক অ্যাকাউন্ট — অন্তত একটা দিন।"}
            )
        return attrs
