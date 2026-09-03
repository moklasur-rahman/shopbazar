def absolute(request, url):
    """
    আপেক্ষিক মিডিয়া পাথকে পূর্ণ URL বানায়: /media/a.jpg → http://host/media/a.jpg

    ফ্রন্টএন্ডের adapters.js পূর্ণ URL পেলে সেটা অপরিবর্তিত রাখে, তাই সব
    জায়গায় পূর্ণ URL পাঠালে VITE_MEDIA_URL ঠিক আছে কি না নিয়ে ভাবতে হয় না।
    """
    if not url:
        return None
    if url.startswith(("http://", "https://", "data:")):
        return url
    if request is None:
        return url
    return request.build_absolute_uri(url)
