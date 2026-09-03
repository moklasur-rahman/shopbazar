from django.utils.text import slugify


def unique_slug(model, base, field="slug", fallback="item", instance=None):
    """
    ইউনিক slug বানায়।

    বাংলা নাম ASCII slugify করলে খালি হয়ে যায় (যেমন "ঢাকা ফ্যাশন" → "")।
    সেক্ষেত্রে fallback ব্যবহার করা হয় — কারণ URL-এ বাংলা অক্ষর থাকলে
    সেটা percent-encode হয়ে দেখতে বিশ্রী লাগে আর শেয়ার করা কঠিন হয়।
    """
    candidate = slugify(base) or fallback
    stem = candidate
    counter = 2

    queryset = model.objects.all()
    if instance is not None and instance.pk:
        queryset = queryset.exclude(pk=instance.pk)

    while queryset.filter(**{field: candidate}).exists():
        candidate = f"{stem}-{counter}"
        counter += 1

    return candidate
