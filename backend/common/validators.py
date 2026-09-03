from django.core.exceptions import ValidationError

#: NID-র ছবি মোবাইলে তোলা হয়, তাই ৫ MB যথেষ্ট। এর বেশি হলে সার্ভারের
#: ডিস্ক আর ব্যাকআপ দুটোই অকারণে ভারী হয়।
MAX_IMAGE_BYTES = 5 * 1024 * 1024

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": "JPG",
    "image/png": "PNG",
    "image/webp": "WEBP",
}


def validate_image_file(file):
    """
    আপলোড করা ছবি যাচাই — আকার ও ফরম্যাট।

    Pillow আলাদা করে যাচাই করে ফাইলটা আসলেই ছবি কি না (ImageField নিজেই
    সেটা করে), এখানে দেখা হয় সেটা আমাদের সীমার মধ্যে আছে কি না।
    """
    size = getattr(file, "size", 0)
    if size > MAX_IMAGE_BYTES:
        mb = size / (1024 * 1024)
        raise ValidationError(
            f"ছবির আকার {mb:.1f} MB — সর্বোচ্চ ৫ MB পর্যন্ত দেওয়া যাবে।"
        )

    content_type = getattr(file, "content_type", None)
    if content_type and content_type not in ALLOWED_IMAGE_TYPES:
        allowed = ", ".join(ALLOWED_IMAGE_TYPES.values())
        raise ValidationError(f"শুধু {allowed} ফরম্যাটের ছবি দেওয়া যাবে।")
