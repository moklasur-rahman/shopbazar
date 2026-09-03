"""
ডেমো ডেটা বসায় — ফ্রন্টএন্ডের src/mock/db.js এর হুবহু প্রতিচ্ছবি।

এক কমান্ডেই সাইটটা ভরে যায়, তাই VITE_USE_MOCK=false করার পরেও
পাতাগুলো ঠিক আগের মতোই দেখায় এবং তুলনা করে দেখা যায় সব মিলছে কি না।

    python manage.py seed              # ডেটা বসাও (আগেরটা থাকলে বাদ দাও)
    python manage.py seed --fresh      # সব মুছে নতুন করে বসাও
"""

from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from apps.accounts.models import User
from apps.catalog.models import (
    Banner, Category, Product, ProductImage, ProductVariant, Review, ReviewPhoto,
)
from apps.orders.models import Order, OrderItem, VendorOrder
from apps.payouts.models import LedgerEntry, Payout
from apps.promotions.models import Coupon
from apps.vendors.models import Vendor, VendorKYC


def img(seed):
    return f"https://picsum.photos/seed/{seed}/700/700"


CATEGORIES = [
    ("electronics", "ইলেকট্রনিক্স", "📱", ["মোবাইল", "ল্যাপটপ", "হেডফোন", "ঘড়ি"]),
    ("fashion", "ফ্যাশন", "👗", ["পাঞ্জাবি", "শাড়ি", "টি-শার্ট", "জুতা"]),
    ("home", "ঘর ও রান্নাঘর", "🏠", ["কুকওয়্যার", "বিছানা", "ডেকোর", "লাইট"]),
    ("beauty", "সৌন্দর্য", "💄", ["স্কিন কেয়ার", "মেকআপ", "চুলের যত্ন"]),
    ("books", "বই ও স্টেশনারি", "📚", ["উপন্যাস", "একাডেমিক", "খাতা-কলম"]),
    ("grocery", "মুদি ও খাবার", "🛒", ["চাল-ডাল", "মসলা", "স্ন্যাকস", "মধু"]),
    ("sports", "খেলাধুলা", "⚽", ["ক্রিকেট", "ফুটবল", "জিম"]),
    ("kids", "শিশু", "🧸", ["খেলনা", "শিশু পোশাক", "ডায়াপার"]),
]

# slug, দোকানের নাম, জেলা, রেটিং, রেটিং সংখ্যা, যাচাই, কমিশন, দিনে পাঠায়, রেসপন্স, ফোন
VENDORS = [
    ("techzone-bd", "টেকজোন বিডি", "ঢাকা", "4.70", 2140, True, "8", 1, 96, "01722222222"),
    ("dhaka-fashion", "ঢাকা ফ্যাশন হাউস", "ঢাকা", "4.50", 1876, True, "10", 2, 92, "01722222223"),
    ("ghoroa", "ঘরোয়া", "চট্টগ্রাম", "4.60", 940, True, "9", 2, 89, "01722222224"),
    ("rupkotha-boi", "রূপকথা বইঘর", "ঢাকা", "4.90", 3320, True, "6", 1, 98, "01722222225"),
    ("shundori", "সুন্দরী কসমেটিকস", "সিলেট", "4.30", 610, False, "12", 3, 84, "01722222226"),
    ("krishoker-bazar", "কৃষকের বাজার", "রাজশাহী", "4.80", 1520, True, "7", 2, 94, "01722222227"),
    ("khelaghor", "খেলাঘর স্পোর্টস", "খুলনা", "4.40", 430, False, "10", 3, 81, "01722222228"),
    ("chotoder-dokan", "ছোটদের দোকান", "ঢাকা", "4.60", 780, True, "9", 2, 90, "01722222229"),
]

# শিরোনাম, ক্যাটাগরি, ভেন্ডর slug, দাম, আগের দাম, স্টক, রেটিং, বিক্রি
PRODUCTS = [
    ("Xiaomi Redmi Note 13 (৮/২৫৬ জিবি)", "electronics", "techzone-bd", 24990, 27990, 18, "4.60", 312),
    ("Realme Buds Air 5 ওয়্যারলেস ইয়ারবাড", "electronics", "techzone-bd", 3450, 4200, 46, "4.40", 890),
    ("Havit HV-KB395L মেকানিক্যাল কীবোর্ড", "electronics", "techzone-bd", 4150, 5000, 12, "4.50", 205),
    ("Xiaomi Smart Band 8 ফিটনেস ব্যান্ড", "electronics", "techzone-bd", 3990, 4800, 33, "4.30", 640),
    ("Anker PowerCore ২০০০০mAh পাওয়ার ব্যাংক", "electronics", "techzone-bd", 3290, None, 27, "4.70", 411),
    ("Logitech M170 ওয়্যারলেস মাউস", "electronics", "techzone-bd", 1150, 1400, 88, "4.20", 1230),
    ("A4Tech FH100i ওভার-ইয়ার হেডফোন", "electronics", "techzone-bd", 1890, 2300, 5, "4.10", 156),

    ("সুতি এমব্রয়ডারি পাঞ্জাবি — অফ হোয়াইট", "fashion", "dhaka-fashion", 1690, 2200, 40, "4.50", 520),
    ("জামদানি মোটিফ সুতি শাড়ি", "fashion", "dhaka-fashion", 2450, 3100, 15, "4.80", 187),
    ("ওভারসাইজড কটন টি-শার্ট (ইউনিসেক্স)", "fashion", "dhaka-fashion", 690, 900, 120, "4.30", 2100),
    ("ডেনিম জ্যাকেট — স্টোন ওয়াশ", "fashion", "dhaka-fashion", 2290, 2900, 22, "4.40", 96),
    ("চামড়ার লোফার — কালো", "fashion", "dhaka-fashion", 3150, 3900, 18, "4.20", 143),
    ("থ্রি-পিস আনস্টিচড লন সেট", "fashion", "dhaka-fashion", 1850, 2400, 35, "4.60", 340),

    ("নন-স্টিক ফ্রাই প্যান ২৬ সেমি", "home", "ghoroa", 1250, 1600, 54, "4.40", 610),
    ("কিং সাইজ কমফোর্টার সেট", "home", "ghoroa", 3450, 4500, 16, "4.60", 210),
    ("স্টেইনলেস স্টিল প্রেসার কুকার ৫ লি.", "home", "ghoroa", 2790, 3400, 24, "4.50", 388),
    ("LED ওয়াল আর্ট — নিয়ন ‘আলো’", "home", "ghoroa", 990, 1400, 41, "4.10", 175),
    ("বাঁশের কাটিং বোর্ড সেট", "home", "ghoroa", 750, None, 68, "4.30", 224),
    ("মাটির কফি মগ (জোড়া)", "home", "ghoroa", 620, 800, 90, "4.70", 512),

    ("হিমু সমগ্র — হুমায়ূন আহমেদ", "books", "rupkotha-boi", 890, 1200, 60, "4.90", 1840),
    ("সেই সময় — সুনীল গঙ্গোপাধ্যায়", "books", "rupkotha-boi", 640, 800, 38, "4.80", 720),
    ("HSC পদার্থবিজ্ঞান ১ম পত্র গাইড", "books", "rupkotha-boi", 420, 520, 150, "4.20", 2600),
    ("A5 হার্ডকভার নোটবুক (২০০ পাতা)", "books", "rupkotha-boi", 280, 350, 200, "4.40", 1450),
    ("জেল পেন সেট — ১০ রঙ", "books", "rupkotha-boi", 190, 260, 320, "4.30", 3100),

    ("ভিটামিন সি ফেস সিরাম ৩০ মিলি", "beauty", "shundori", 850, 1200, 44, "4.30", 680),
    ("আর্গান অয়েল হেয়ার মাস্ক", "beauty", "shundori", 690, 900, 52, "4.20", 410),
    ("ম্যাট লিকুইড লিপস্টিক — ৬ শেড", "beauty", "shundori", 1150, 1500, 28, "4.40", 295),
    ("সানস্ক্রিন SPF ৫০+ পিএ+++", "beauty", "shundori", 780, 950, 66, "4.60", 890),

    ("চিনিগুঁড়া চাল ৫ কেজি", "grocery", "krishoker-bazar", 720, 850, 110, "4.70", 1520),
    ("সুন্দরবনের খাঁটি মধু ৫০০ গ্রাম", "grocery", "krishoker-bazar", 950, 1250, 47, "4.80", 940),
    ("সরিষার তেল (ঘানি ভাঙা) ১ লিটার", "grocery", "krishoker-bazar", 420, 500, 130, "4.60", 1780),
    ("মিক্সড ড্রাই ফ্রুটস ৫০০ গ্রাম", "grocery", "krishoker-bazar", 890, 1100, 39, "4.50", 520),
    ("খেজুরের গুড় ১ কেজি", "grocery", "krishoker-bazar", 560, 700, 72, "4.70", 630),

    ("ইংলিশ উইলো ক্রিকেট ব্যাট", "sports", "khelaghor", 4800, 6200, 9, "4.50", 78),
    ("ফুটবল সাইজ ৫ — ম্যাচ কোয়ালিটি", "sports", "khelaghor", 1350, 1700, 33, "4.30", 240),
    ("যোগা ম্যাট ৬ মিমি অ্যান্টি-স্লিপ", "sports", "khelaghor", 1100, 1450, 48, "4.40", 356),
    ("অ্যাডজাস্টেবল ডাম্বেল ১০ কেজি জোড়া", "sports", "khelaghor", 3900, 4800, 11, "4.60", 92),

    ("কাঠের বিল্ডিং ব্লক ১০০ পিস", "kids", "chotoder-dokan", 1250, 1600, 37, "4.70", 410),
    ("রিমোট কন্ট্রোল রেসিং কার", "kids", "chotoder-dokan", 1890, 2400, 21, "4.20", 168),
    ("শিশুদের সুতি ফ্রক (২-৪ বছর)", "kids", "chotoder-dokan", 750, 950, 64, "4.50", 320),
    ("সফট টেডি বিয়ার — ৪০ সেমি", "kids", "chotoder-dokan", 890, 1150, 43, "4.60", 275),
]

SIZE_CATEGORIES = {"fashion", "kids"}

REVIEW_TEXTS = [
    ("একদম ছবির মতোই পেয়েছি। প্যাকেজিং খুব ভালো ছিল।", 5),
    ("দাম অনুযায়ী মান ঠিক আছে। ডেলিভারি একদিন দেরি হয়েছে।", 4),
    ("অসাধারণ! আবার অর্ডার করব ইনশাআল্লাহ।", 5),
    ("মোটামুটি। আশা করেছিলাম আরেকটু ভালো হবে।", 3),
    ("বিক্রেতা খুব দ্রুত রেসপন্স করেছেন, ধন্যবাদ।", 5),
    ("কোয়ালিটি ভালো, তবে সাইজ একটু ছোট মনে হলো।", 4),
    ("ঠিকঠাক পেয়েছি, সবাইকে সাজেস্ট করব।", 5),
]

REVIEWERS = [
    "রফিকুল ইসলাম", "নাসরিন আক্তার", "সাব্বির হোসেন", "তানিয়া রহমান",
    "মেহেদী হাসান", "ফারজানা ইয়াসমিন", "আরিফুল হক", "শারমিন সুলতানা",
]

BANNERS = [
    ("ঈদ কালেকশন ২০২৬", "পাঞ্জাবি, শাড়ি ও থ্রি-পিসে ৪০% পর্যন্ত ছাড়",
     "কিনতে যান", "/products?category=fashion", "hero-eid", "brand"),
    ("গ্যাজেট উইক", "ইয়ারবাড, স্মার্টওয়াচ ও পাওয়ার ব্যাংকে বিশেষ দাম",
     "অফার দেখুন", "/products?category=electronics", "hero-tech", "dark"),
    ("কৃষকের বাজার", "খাঁটি মধু, ঘানি ভাঙা তেল আর দেশি চাল",
     "অর্ডার করুন", "/products?category=grocery", "hero-grocery", "accent"),
]


def make_slug(title, index):
    return slugify(title) or f"product-{index}"


class Command(BaseCommand):
    help = "ডেমো ডেটা বসায় (ফ্রন্টএন্ডের mock ডেটার হুবহু কপি)"

    def add_arguments(self, parser):
        parser.add_argument("--fresh", action="store_true",
                            help="আগের সব ডেমো ডেটা মুছে নতুন করে বসাও")
        parser.add_argument("--password", default="1234",
                            help="ডেমো অ্যাকাউন্টের পাসওয়ার্ড (ডিফল্ট 1234)")

    @transaction.atomic
    def handle(self, *args, **options):
        password = options["password"]

        if options["fresh"]:
            self.stdout.write("আগের ডেটা মোছা হচ্ছে…")
            for model in (OrderItem, VendorOrder, Order, LedgerEntry, Payout,
                          ReviewPhoto, Review, ProductImage, ProductVariant,
                          Product, Coupon, Banner, VendorKYC, Vendor, Category):
                model.objects.all().delete()
            User.objects.filter(is_superuser=False).delete()

        categories = self._seed_categories()
        vendors = self._seed_vendors(password)
        products = self._seed_products(categories, vendors)
        self._seed_reviews(products)
        self._seed_coupons(vendors)
        self._seed_banners()
        customer = self._seed_customer(password)
        self._seed_sample_order(customer, products)

        self.stdout.write(self.style.SUCCESS("\n✓ ডেমো ডেটা তৈরি হয়েছে\n"))
        self.stdout.write(f"  ক্যাটাগরি : {Category.objects.count()}")
        self.stdout.write(f"  দোকান     : {Vendor.objects.count()}")
        self.stdout.write(f"  পণ্য      : {Product.objects.count()}")
        self.stdout.write(f"  ভ্যারিয়েন্ট : {ProductVariant.objects.count()}")
        self.stdout.write(f"  রিভিউ     : {Review.objects.count()}")
        self.stdout.write("\n  ডেমো লগইন")
        self.stdout.write(f"    ক্রেতা   : 01711111111 / {password}")
        self.stdout.write(f"    বিক্রেতা : 01722222222 / {password}")
        self.stdout.write("\n  অ্যাডমিন বানাতে: python manage.py createsuperuser\n")

    # ---------------------------------------------------------------- parts

    def _seed_categories(self):
        categories = {}
        for order, (slug, name, icon, children) in enumerate(CATEGORIES):
            parent, _ = Category.objects.update_or_create(
                slug=slug,
                defaults={"name": name, "icon": icon, "sort_order": order, "parent": None},
            )
            categories[slug] = parent
            for child_order, child_name in enumerate(children):
                Category.objects.update_or_create(
                    slug=f"{slug}-{slugify(child_name) or child_order}",
                    defaults={"name": child_name, "parent": parent, "sort_order": child_order},
                )
        return categories

    def _seed_vendors(self, password):
        vendors = {}
        for slug, name, district, rating, count, verified, commission, ships, response, phone in VENDORS:
            owner = User.objects.filter(phone=phone).first()
            if owner is None:
                owner = User.objects.create_user(
                    phone=phone, password=password, full_name=name,
                    role=User.Role.VENDOR, is_phone_verified=True,
                )

            vendor, _ = Vendor.objects.update_or_create(
                slug=slug,
                defaults={
                    "owner": owner,
                    "shop_name": name,
                    "district": district,
                    "logo_url": img(f"shop-{slug}"),
                    "banner_url": img(f"banner-{slug}"),
                    "status": Vendor.Status.APPROVED,
                    "is_verified": verified,
                    "commission_rate": Decimal(commission),
                    "ships_in_days": ships,
                    "response_rate": response,
                    "rating_avg": Decimal(rating),
                    "rating_count": count,
                },
            )
            VendorKYC.objects.update_or_create(
                vendor=vendor,
                defaults={
                    "nid_number": f"19901234{vendor.id:06d}",
                    "bkash_number": phone,
                    "reviewed_at": timezone.now(),
                },
            )
            vendors[slug] = vendor
        return vendors

    def _build_variants(self, product, category_slug, price, compare_at, stock):
        if category_slug in SIZE_CATEGORIES:
            sizes = (["২-৩ বছর", "৪-৫ বছর", "৬-৭ বছর"]
                     if category_slug == "kids" else ["S", "M", "L", "XL"])
            colors = ["কালো", "সাদা", "নেভি"]
            per_variant = max(1, stock // (len(sizes) * len(colors)))

            for si, size in enumerate(sizes):
                for ci, color in enumerate(colors):
                    ProductVariant.objects.create(
                        product=product,
                        sku=f"{product.slug[:10].upper()}-{si}{ci}",
                        options={"সাইজ": size, "রঙ": color},
                        price=Decimal(price + si * 50),
                        compare_at_price=Decimal(compare_at + si * 50) if compare_at else None,
                        stock=per_variant + (3 if ci == 1 else 0),
                        weight_kg=Decimal("0.40"),
                    )
        else:
            ProductVariant.objects.create(
                product=product,
                sku=f"{product.slug[:14].upper()}-STD",
                options={},
                price=Decimal(price),
                compare_at_price=Decimal(compare_at) if compare_at else None,
                stock=stock,
                weight_kg=Decimal("0.60"),
            )

    def _seed_products(self, categories, vendors):
        products = []
        for index, (title, cat_slug, vendor_slug, price, compare_at, stock, rating, sold) in enumerate(PRODUCTS):
            vendor = vendors[vendor_slug]
            slug = make_slug(title, index + 1)

            product, created = Product.objects.update_or_create(
                slug=slug,
                defaults={
                    "vendor": vendor,
                    "category": categories[cat_slug],
                    "title": title,
                    "description": (
                        f"{title} — {vendor.shop_name} থেকে সরাসরি। প্রতিটি পণ্য পাঠানোর "
                        f"আগে যাচাই করা হয়। ৭ দিনের রিটার্ন সুবিধা, এবং সারা বাংলাদেশে "
                        f"হোম ডেলিভারি।"
                    ),
                    "status": Product.Status.LIVE,
                    "free_shipping": price >= 2000,
                    "rating_avg": Decimal(rating),
                    "rating_count": int(sold * 0.28),
                    "sold_count": sold,
                    "specs": {
                        "ব্র্যান্ড": vendor.shop_name,
                        "ওয়ারেন্টি": "৬ মাস সার্ভিস ওয়ারেন্টি" if cat_slug == "electronics" else "প্রযোজ্য নয়",
                        "পণ্য কোড": f"SB-{1000 + index}",
                        "কোথা থেকে": vendor.district,
                    },
                    "created_at": timezone.now() - timedelta(days=(index + 1) * 3),
                },
            )

            if created or not product.images.exists():
                product.images.all().delete()
                ProductImage.objects.bulk_create([
                    ProductImage(product=product, image_url=img(f"{slug}-{n}"), sort_order=n - 1)
                    for n in range(1, 5)
                ])

            if created or not product.variants.exists():
                product.variants.all().delete()
                self._build_variants(product, cat_slug, price, compare_at, stock)

            product.sync_from_variants()
            products.append(product)
        return products

    def _seed_reviews(self, products):
        for product in products:
            if product.reviews.exists():
                continue
            count = 3 + (product.id % 4)
            for i in range(count):
                comment, rating = REVIEW_TEXTS[(product.id + i) % len(REVIEW_TEXTS)]
                review = Review.objects.create(
                    product=product,
                    author_name=REVIEWERS[(product.id + i) % len(REVIEWERS)],
                    rating=rating,
                    comment=comment,
                    is_verified_purchase=i % 3 != 0,
                    created_at=timezone.now() - timedelta(days=(i + 1) * 6),
                )
                if i == 0:
                    ReviewPhoto.objects.create(review=review, image_url=img(f"{product.slug}-rev"))

    def _seed_coupons(self, vendors):
        far_future = timezone.now() + timedelta(days=365)
        rows = [
            ("SHOPBAZAR100", "flat", 100, 1000, None, None, 1000, 214, "৳১০০ ছাড় — সব দোকানে"),
            ("EID15", "percent", 15, 1500, 500, None, 500, 380, "ঈদ অফার — ১৫% (সর্বোচ্চ ৳৫০০)"),
            ("TECH500", "flat", 500, 5000, None, "techzone-bd", 200, 65, "টেকজোন বিডি — ৳৫০০ ছাড়"),
            ("BOI10", "percent", 10, 500, 200, "rupkotha-boi", None, 90, "রূপকথা বইঘর — ১০% ছাড়"),
        ]
        for code, kind, value, min_order, max_disc, vendor_slug, limit, used, label in rows:
            Coupon.objects.update_or_create(
                code=code,
                defaults={
                    "type": kind,
                    "value": Decimal(value),
                    "min_order": Decimal(min_order),
                    "max_discount": Decimal(max_disc) if max_disc else None,
                    "vendor": vendors.get(vendor_slug) if vendor_slug else None,
                    "expires_at": far_future,
                    "usage_limit": limit,
                    "used_count": used,
                    "label": label,
                },
            )

    def _seed_banners(self):
        for order, (title, subtitle, cta, href, seed, tone) in enumerate(BANNERS):
            Banner.objects.update_or_create(
                title=title,
                defaults={
                    "subtitle": subtitle, "cta": cta, "href": href,
                    "image_url": img(seed), "tone": tone, "sort_order": order,
                },
            )

    def _seed_customer(self, password):
        customer = User.objects.filter(phone="01711111111").first()
        if customer is None:
            customer = User.objects.create_user(
                phone="01711111111", password=password, full_name="রাকিব হাসান",
                email="rakib@example.com", is_phone_verified=True,
            )
        return customer

    def _seed_sample_order(self, customer, products):
        """
        একটা নমুনা অর্ডার — দুই দোকানের পণ্য নিয়ে, যাতে ভেন্ডর ড্যাশবোর্ড
        আর "আমার অর্ডার" পাতা খালি না দেখায়।
        """
        if Order.objects.filter(customer=customer).exists():
            return

        from apps.orders.services import place_order, settle_vendor_order

        phone_product = products[0]           # টেকজোন বিডি
        book_product = next(p for p in products if p.vendor.slug == "rupkotha-boi")

        items = [
            {"variant": phone_product.variants.first().id, "quantity": 1},
            {"variant": book_product.variants.first().id, "quantity": 2},
        ]
        address = {
            "receiver_name": "রাকিব হাসান",
            "phone": "01711111111",
            "division": "ঢাকা",
            "district": "ঢাকা",
            "thana": "ধানমন্ডি",
            "address_line": "বাসা ১২, রোড ৫, ধানমন্ডি আবাসিক এলাকা",
            "note": "বিকেলের পর কল দিবেন",
        }

        order = place_order(customer, items, address, payment_method="cod")

        # প্রথম পার্সেলটা ডেলিভারি করে দেওয়া হলো, যাতে লেজারে টাকা দেখা যায়
        first_parcel = order.vendor_orders.first()
        first_parcel.status = VendorOrder.Status.DELIVERED
        first_parcel.save(update_fields=["status"])
        settle_vendor_order(first_parcel)
