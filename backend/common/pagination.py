from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    """
    ফ্রন্টএন্ড `?page=2&page_size=12` পাঠায় এবং
    {count, next, previous, results} আকারে উত্তর আশা করে —
    DRF-এর ডিফল্ট আকারই সেটা, শুধু page_size চালু করে দিতে হয়।
    """

    page_size_query_param = "page_size"
    max_page_size = 100
