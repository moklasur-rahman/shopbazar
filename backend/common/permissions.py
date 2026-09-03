from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsStaffUser(BasePermission):
    """
    প্ল্যাটফর্মের অ্যাডমিন — ভেন্ডর অনুমোদন, পণ্য মডারেশন, পে-আউট।

    Django-র `is_staff` ফ্ল্যাগই একমাত্র সত্য। `role` ফিল্ডে staff লেখা
    থাকলেও যথেষ্ট নয় — কারণ ওটা রেজিস্ট্রেশনের সময় ব্যবহারকারীর পাঠানো
    ডেটা থেকে আসতে পারত।
    """

    message = "এই অংশটি শুধু প্ল্যাটফর্ম অ্যাডমিনদের জন্য।"

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_staff)


class IsVendor(BasePermission):
    """
    দোকান আছে — অনুমোদিত হোক বা না হোক।

    অনুমোদনের অপেক্ষায় থাকা বিক্রেতাও কিছু কাজ করতে পারতে হবে: KYC কাগজ
    জমা দেওয়া, নিজের আবেদনের অবস্থা দেখা। সেসবের জন্য এই পারমিশন।
    """

    message = "এই অংশটি শুধু বিক্রেতাদের জন্য।"

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and getattr(user, "vendor", None))


class IsApprovedVendor(BasePermission):
    """
    ভেন্ডর প্যানেলের গেট।

    মনে রাখবেন: এই পারমিশন শুধু দরজা খোলে। কোন ভেন্ডরের ডেটা দেখা যাবে
    সেটা ঠিক হয় ভিউয়ের get_queryset()-এ — সেখানে সবসময়
    `filter(vendor=request.user.vendor)` লিখতে হবে, URL থেকে আসা
    vendor_id বিশ্বাস করা যাবে না।
    """

    message = "এই অংশটি শুধু অনুমোদিত বিক্রেতাদের জন্য।"

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        vendor = getattr(user, "vendor", None)
        return vendor is not None and vendor.status == "approved"


class IsOwnerOrReadOnly(BasePermission):
    """নিজের জিনিস ছাড়া কেউ বদলাতে পারবে না।"""

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        owner = getattr(obj, "user", None) or getattr(obj, "customer", None)
        return owner == request.user
