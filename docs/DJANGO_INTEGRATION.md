# Django ব্যাকএন্ড যোগ করার গাইড

এই ফ্রন্টএন্ড এমনভাবে বানানো যে ব্যাকএন্ড যোগ করতে **কোনো কম্পোনেন্ট বদলাতে হবে না**।
যা করতে হবে: Django-তে নিচের এন্ডপয়েন্টগুলো বানান, তারপর `.env`-এ একটা লাইন বদলান।

```bash
VITE_USE_MOCK=false
VITE_API_URL=http://127.0.0.1:8000/api/v1
```

---

## ১. কীভাবে সুইচটা কাজ করে

```
কম্পোনেন্ট  →  api  →  ┌── mock/services.js   (VITE_USE_MOCK=true)
                        └── api/services.js    (VITE_USE_MOCK=false)
                                 ↓
                            api/client.js  →  Django
                                 ↓
                            api/adapters.js  (snake_case → camelCase)
```

দুই দিকের ফাংশনের **নাম এক, প্যারামিটার এক, রিটার্নের আকার এক**। তাই সুইচ করলে
কম্পোনেন্ট টেরই পায় না।

`frontend/src/api/index.js` দেখুন — মাত্র ২০ লাইন।

---

## ২. Django প্রজেক্ট সেটআপ

```bash
mkdir backend && cd backend
python -m venv .venv
.venv\Scripts\activate
pip install django djangorestframework djangorestframework-simplejwt django-cors-headers python-decouple psycopg2-binary pillow
django-admin startproject config .
```

### settings.py-তে যা লাগবে

```python
INSTALLED_APPS = [
    # ...
    "rest_framework",
    "corsheaders",
    "apps.accounts",
    "apps.vendors",
    "apps.catalog",
    "apps.orders",
    "apps.payments",
    "apps.payouts",
    "apps.promotions",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",   # সবার উপরে
    # ...
]

CORS_ALLOWED_ORIGINS = ["http://localhost:5173"]

AUTH_USER_MODEL = "accounts.User"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PAGINATION_CLASS":
        "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 12,                      # config.js এর RULES.pageSize এর সমান
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
}
```

> **পেজিনেশন:** ফ্রন্টএন্ড DRF-এর ডিফল্ট `{count, next, previous, results}` আকারই
> আশা করে। `PageNumberPagination` রাখলে কিছু বদলাতে হবে না।
> `?page=2&page_size=12` — এই দুইটা প্যারামিটার ফ্রন্টএন্ড পাঠায়।

---

## ৩. এন্ডপয়েন্ট তালিকা

`frontend/src/api/endpoints.js` ফাইলটাই আপনার চেকলিস্ট। নিচে প্রতিটার প্রত্যাশিত JSON।

### ৩.১ Auth

| মেথড | পাথ | বডি | রেসপন্স |
|------|-----|-----|---------|
| POST | `/auth/register/` | `full_name, phone, email, password, role, shop_name?` | `{access, refresh, user}` |
| POST | `/auth/token/` | `phone, password` | `{access, refresh, user?}` |
| POST | `/auth/token/refresh/` | `refresh` | `{access, refresh?}` |
| GET | `/auth/me/` | — | user অবজেক্ট |

**user অবজেক্ট:**

```json
{
  "id": 1,
  "full_name": "রাকিব হাসান",
  "phone": "01711111111",
  "email": "rakib@example.com",
  "role": "customer",
  "avatar": "/media/avatars/1.jpg",
  "vendor": { "slug": "techzone-bd" }
}
```

`role` অবশ্যই `customer` / `vendor` / `staff` এর একটা — ফ্রন্টএন্ড এটা দিয়েই
ভেন্ডর প্যানেলের গার্ড চালায়।

### ৩.২ Catalog

```
GET /catalog/categories/
GET /catalog/products/?search=&category=&vendor=&min_price=&max_price=
                       &rating=&free_shipping=&ordering=&page=&page_size=
GET /catalog/products/<slug>/
GET /catalog/products/<slug>/reviews/
GET /catalog/banners/
GET /catalog/flash-sale/
```

`ordering` এর যে মানগুলো ফ্রন্টএন্ড পাঠায়:
`-created_at`, `-sold_count`, `price`, `-price`, `-rating_avg`
— ViewSet-এ `ordering_fields = ["created_at", "sold_count", "price", "rating_avg"]` দিন।

**প্রোডাক্ট সিরিয়ালাইজার:**

```json
{
  "id": 1,
  "slug": "redmi-note-13",
  "title": "Xiaomi Redmi Note 13",
  "description": "…",
  "images": [{ "image": "/media/products/1.jpg" }],
  "category": { "slug": "electronics", "name": "ইলেকট্রনিক্স" },
  "vendor": { "id": 1, "slug": "techzone-bd", "shop_name": "টেকজোন বিডি",
              "logo": "/media/shops/1.png", "rating_avg": "4.7",
              "is_verified": true, "commission_rate": "8.00",
              "ships_in_days": 1, "district": "ঢাকা", "product_count": 7 },
  "variants": [
    { "id": 11, "sku": "RN13-8-256", "options": { "রঙ": "কালো" },
      "price": "24990.00", "compare_at_price": "27990.00",
      "stock": 18, "weight_kg": "0.30" }
  ],
  "price": "24990.00",
  "compare_at_price": "27990.00",
  "stock": 18,
  "rating_avg": "4.60",
  "rating_count": 87,
  "sold_count": 312,
  "free_shipping": true,
  "status": "live",
  "created_at": "2026-08-01T10:00:00Z",
  "specs": { "ওয়ারেন্টি": "৬ মাস" }
}
```

> **`variants` সবসময় পাঠাবেন**, এমনকি একটাই হলেও। ফ্রন্টএন্ড ভ্যারিয়েন্ট থেকেই
> দাম আর স্টক পড়ে। `options` একটা JSON — কী-এর নাম যা খুশি (`সাইজ`, `রঙ`,
> `ওজন`) — UI নিজে থেকেই সেই অনুযায়ী বাটনের সারি বানিয়ে নেবে।

### ৩.৩ Checkout

```
POST /promotions/coupons/validate/   { code }
POST /checkout/quote/                { items: [{variant, quantity}], district, coupon_code }
```

`quote` এর রেসপন্স:

```json
{
  "items_total": 26770,
  "shipping_total": 30,
  "discount_total": 0,
  "grand_total": 26800,
  "coupon_error": null
}
```

এই হিসাবটা **সার্ভারেই চূড়ান্ত**। ফ্রন্টএন্ডের `calculateCart()` শুধু সাথে সাথে
দেখানোর জন্য — ব্রাউজার থেকে দাম বদলে দেওয়া যাবে না।

### ৩.৪ Orders

```
POST /orders/            অর্ডার তৈরি
GET  /orders/            নিজের অর্ডারের তালিকা
GET  /orders/<number>/   একটা অর্ডার
POST /orders/vendor-orders/<id>/cancel/
```

**POST /orders/ এর বডি** (ফ্রন্টএন্ড যা পাঠায়):

```json
{
  "items": [{ "variant": 11, "quantity": 1 }],
  "shipping_address": {
    "receiver_name": "রফিকুল ইসলাম",
    "phone": "01712345678",
    "division": "ঢাকা", "district": "ঢাকা", "thana": "ধানমন্ডি",
    "address_line": "বাসা ১২, রোড ৫", "note": ""
  },
  "payment_method": "cod",
  "coupon_code": null
}
```

**রেসপন্স — এখানেই মাল্টি-ভেন্ডরের মূল কথা:**

```json
{
  "order_number": "SB-100241",
  "created_at": "2026-09-03T12:00:00Z",
  "payment_method": "cod",
  "payment_status": "pending",
  "shipping_address": { "...": "উপরের মতোই" },
  "items_total": "26770.00",
  "shipping_total": "30.00",
  "discount_total": "0.00",
  "grand_total": "26800.00",
  "vendor_orders": [
    {
      "id": 55,
      "sub_number": "SB-100241-A",
      "vendor": { "...": "vendor অবজেক্ট" },
      "status": "pending",
      "subtotal": "24990.00",
      "discount": "0.00",
      "shipping_fee": "0.00",
      "commission_amount": "1999.00",
      "payable": "22991.00",
      "courier": null,
      "tracking_code": null,
      "items": [
        {
          "id": 91,
          "product_title": "Xiaomi Redmi Note 13",
          "product_slug": "redmi-note-13",
          "image": "/media/products/1.jpg",
          "options": { "রঙ": "কালো" },
          "unit_price": "24990.00",
          "quantity": 1,
          "can_review": false
        }
      ]
    }
  ]
}
```

`status` এর মান শুধু এই সাতটার একটা হতে হবে:
`pending` · `confirmed` · `packed` · `shipped` · `delivered` · `cancelled` · `returned`
(দেখুন `frontend/src/lib/bd.js` → `ORDER_STATUS`)

### ৩.৫ ভেন্ডর প্যানেল

```
GET   /vendor/stats/
GET   /vendor/products/          POST /vendor/products/
PATCH /vendor/products/<id>/     DELETE /vendor/products/<id>/
GET   /vendor/orders/?status=
PATCH /vendor/orders/<id>/       { status }
GET   /vendor/ledger/
GET   /vendor/payouts/           POST /vendor/payouts/  { amount }
```

**`/vendor/stats/` রেসপন্স:**

```json
{
  "today_sales": 22400, "month_sales": 394400,
  "pending_orders": 6, "low_stock": 3, "total_products": 7,
  "available_balance": 27063, "on_hold": 3174, "rating": 4.7,
  "sales_trend": [{ "day": "শনি", "amount": 8200 }]
}
```

---

## ৪. সবচেয়ে জরুরি তিনটা ব্যাকএন্ড লজিক

### ৪.১ অর্ডার ভাগ করা + স্টক লক

`frontend/src/lib/pricing.js` এর `calculateCart()` এর Django রূপ:

```python
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP
from django.db import transaction

@transaction.atomic
def place_order(user, items, address, coupon=None, payment_method="cod"):
    buckets = defaultdict(list)
    for row in items:
        variant = ProductVariant.objects.select_related("product__vendor").get(pk=row["variant"])
        buckets[variant.product.vendor_id].append((variant, row["quantity"]))

    order = Order.objects.create(
        customer=user,
        shipping_address=address,          # JSONField — snapshot
        payment_method=payment_method,
    )

    inside_dhaka = address["district"] == "ঢাকা"

    for index, (vendor_id, rows) in enumerate(buckets.items()):
        vo = VendorOrder.objects.create(order=order, vendor_id=vendor_id)

        for variant, qty in rows:
            # 🔒 row lock — একই স্টকে দুইজন যেন একসাথে না ঢোকে
            locked = ProductVariant.objects.select_for_update().get(pk=variant.pk)
            if locked.stock < qty:
                raise OutOfStock(locked.sku)
            locked.stock -= qty
            locked.save(update_fields=["stock"])

            OrderItem.objects.create(
                vendor_order=vo,
                variant=locked,
                product_title=locked.product.title,   # snapshot
                unit_price=locked.price,              # snapshot
                quantity=qty,
            )

        vo.subtotal = sum(i.unit_price * i.quantity for i in vo.items.all())
        vo.shipping_fee = shipping_for_vendor(index, vo.subtotal, inside_dhaka)
        vo.save()

    order.recalculate()
    return order
```

### ৪.২ ডেলিভারি চার্জ (হুবহু ফ্রন্টএন্ডের নিয়ম)

```python
INSIDE_DHAKA = 60
OUTSIDE_DHAKA = 120
EXTRA_VENDOR_MULTIPLIER = Decimal("0.5")
FREE_SHIPPING_THRESHOLD = 2000

def shipping_for_vendor(index, vendor_subtotal, inside_dhaka):
    if vendor_subtotal >= FREE_SHIPPING_THRESHOLD:
        return 0
    base = INSIDE_DHAKA if inside_dhaka else OUTSIDE_DHAKA
    if index == 0:
        return base
    return int(base * EXTRA_VENDOR_MULTIPLIER)
```

### ৪.৩ ভেন্ডরের পারমিশন — সবচেয়ে সাধারণ সিকিউরিটি বাগ

```python
class VendorOrderViewSet(viewsets.ModelViewSet):
    serializer_class = VendorOrderSerializer
    permission_classes = [IsAuthenticated, IsVendor]

    def get_queryset(self):
        # ✅ সবসময় লগইন করা ভেন্ডরের নিজের ডেটা
        return VendorOrder.objects.filter(vendor=self.request.user.vendor)

        # ❌ কখনো নয়:
        # return VendorOrder.objects.filter(vendor_id=self.request.query_params["vendor"])
        #    → একজন ভেন্ডর অন্যজনের আইডি বসিয়ে অর্ডার দেখে ফেলবে
```

---

## ৫. মিলিয়ে দেখার চেকলিস্ট

Django বানানোর পর `VITE_USE_MOCK=false` করে এই ধাপগুলো একবার করে দেখুন:

- [ ] হোম পেজে প্রোডাক্ট আসছে (`/catalog/products/`)
- [ ] ফিল্টার ও সর্টিং কাজ করছে (query param ঠিকমতো যাচ্ছে কি না নেটওয়ার্ক ট্যাবে দেখুন)
- [ ] পণ্যের পাতায় ভ্যারিয়েন্ট বাটন আসছে (`variants` ফাঁকা নয় তো?)
- [ ] লগইনের পর `/auth/me/` ইউজার ফেরত দিচ্ছে, `role` ঠিক আছে
- [ ] কার্টে দুই দোকানের পণ্য দিলে দুইটা পার্সেল দেখাচ্ছে
- [ ] অর্ডার করলে `vendor_orders` অ্যারে আসছে (একাধিক দোকান হলে একাধিক)
- [ ] ভেন্ডর লগইনে `/vendor/orders/`-এ শুধু নিজের অর্ডার আসছে
- [ ] অ্যাক্সেস টোকেন এক্সপায়ার হলে নিজে থেকে রিফ্রেশ হচ্ছে (`client.js` করে দেয়)

---

## ৬. ফিল্ডের নাম বদলাতে চাইলে

ব্যাকএন্ডে অন্য নাম ব্যবহার করলে **শুধু `frontend/src/api/adapters.js`** ঠিক করুন।
কম্পোনেন্টগুলো ওই ফাইলের বের করা নামগুলোই চেনে, তাই বাকি কোথাও হাত দিতে হবে না।

```js
// উদাহরণ — ব্যাকএন্ডে shop_name এর বদলে name হলে:
export function toVendor(raw = {}) {
  return {
    shopName: raw.name ?? raw.shop_name,   // ← এই একটা লাইনই যথেষ্ট
    // ...
  };
}
```
