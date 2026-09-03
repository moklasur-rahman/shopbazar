# শপবাজার — Django ব্যাকএন্ড

Django 5.2 · DRF 3.18 · SimpleJWT · SQLite (PostgreSQL-এ সহজে বদলানো যায়)

`../src/api/endpoints.js` ফাইলে ফ্রন্টএন্ড যে যে এন্ডপয়েন্ট ডাকে, তার
প্রত্যেকটার বাস্তবায়ন এখানে আছে — ফিল্ডের নাম পর্যন্ত মিলিয়ে।

---

## ১. চালু করা

```bash
cd backend
py -3.13 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe manage.py migrate
.venv\Scripts\python.exe manage.py seed
.venv\Scripts\python.exe manage.py runserver
```

সার্ভার: <http://127.0.0.1:8000> · অ্যাডমিন: <http://127.0.0.1:8000/django-admin/>

### API ডকুমেন্টেশন

| ঠিকানা | কী |
|--------|-----|
| <http://127.0.0.1:8000/api/docs/> | **Swagger UI** — ব্রাউজার থেকেই এন্ডপয়েন্ট পরীক্ষা করা যায় |
| <http://127.0.0.1:8000/api/redoc/> | ReDoc — পড়ার জন্য সুন্দর |
| <http://127.0.0.1:8000/api/schema/> | OpenAPI 3 স্কিমা (YAML) |

Swagger UI-তে **Authorize** বোতামে `Bearer <access-token>` দিলে
লগইন-লাগে এমন এন্ডপয়েন্টও সেখান থেকেই চালানো যায়।

### টেস্ট

```bash
.venv\Scripts\python.exe -m pytest              # ৮৭টি টেস্ট
.venv\Scripts\python.exe -m pytest --cov=apps   # কভারেজসহ
.venv\Scripts\python.exe -m pytest -k pricing   # শুধু দামের টেস্ট
```

`tests/` ফোল্ডারে তিনটা ফাইল:

| ফাইল | কী পাহারা দেয় |
|------|----------------|
| `test_pricing.py` | ডেলিভারি চার্জ ও কুপনের নিয়ম (ডেটাবেস ছাড়াই) |
| `test_orders.py` | পার্সেলে ভাগ, কমিশন, স্টক লক, snapshot |
| `test_security.py` | কে কার ডেটা দেখতে পারে না |

### লাইভে যাওয়ার আগের চেক

```bash
set DJANGO_DEBUG=False
.venv\Scripts\python.exe manage.py check --deploy
```

নিরাপত্তার ওয়ার্নিং শূন্য আসা উচিত। (drf_spectacular-এর কয়েকটা
স্কিমা-নামকরণের ওয়ার্নিং থাকতে পারে — ওগুলো নিরাপত্তার নয়।)

অ্যাডমিন লগইন বানাতে:

```bash
.venv\Scripts\python.exe manage.py createsuperuser
```

### ডেমো অ্যাকাউন্ট (seed কমান্ড তৈরি করে)

| ভূমিকা | মোবাইল | পাসওয়ার্ড |
|--------|--------|-----------|
| ক্রেতা | `01711111111` | `1234` |
| বিক্রেতা (টেকজোন বিডি) | `01722222222` | `1234` |

বাকি ৭টি দোকানের মালিকও `01722222223` থেকে `01722222229` নম্বরে আছে,
পাসওয়ার্ড একই।

---

## ২. ফ্রন্টএন্ডের সাথে যুক্ত করা

`../.env` ফাইলে:

```bash
VITE_USE_MOCK=false
VITE_API_URL=http://127.0.0.1:8000/api/v1
VITE_MEDIA_URL=http://127.0.0.1:8000
```

দুইটা সার্ভার একসাথে চালাতে হবে — একটা টার্মিনালে Django, আরেকটায়
`npm run dev`।

`VITE_USE_MOCK=true` করলে ব্যাকএন্ড ছাড়াই সাইট চলে (ডেমো দেখানোর জন্য)।

---

## ৩. ক্রেতা ও বিক্রেতা — দুই আলাদা ফ্লো

একটাই `User` মডেল, আলাদা করে `role` ফিল্ড (`customer` / `vendor` / `staff`)।
রেজিস্ট্রেশন আর লগইনের **এন্ডপয়েন্ট একটাই**, শুধু `role` পাঠানোর উপর
পার্থক্য।

### ক্রেতা — সাথে সাথে চালু

```
/register  (ক্রেতা বেছে নিন)
   ↓  POST /auth/register/  {role: "customer"}
অ্যাকাউন্ট তৈরি → টোকেন → কেনাকাটা শুরু
```

কোনো অনুমোদন লাগে না। রেজিস্ট্রেশনের সাথে সাথেই কার্ট, চেকআউট, অর্ডার —
সব খুলে যায়।

### বিক্রেতা — অনুমোদন লাগে

```
/sell → /register?role=vendor
   ↓  POST /auth/register/  {role: "vendor", shop_name: "…"}
Vendor তৈরি, status = pending          ← পণ্য এখনো সাইটে দেখা যাবে না
   ↓  লগইন করলে /vendor → "অনুমোদনের অপেক্ষায়" পাতা
   ↓  PUT /vendor/application/  {nid_number, bkash_number, district}
অ্যাডমিন যাচাই করে অনুমোদন দেন
   ↓  status = approved
পুরো ভেন্ডর প্যানেল খুলে যায়
```

`pending` অবস্থায় প্যানেলের সব এন্ডপয়েন্ট **৪০৩** দেয়
(`IsApprovedVendor`)। শুধু `/vendor/application/` খোলা থাকে
(`IsVendor`) — যাতে বিক্রেতা নিজের অবস্থা দেখতে আর কাগজপত্র জমা দিতে
পারেন।

### লগইনের পর কে কোথায় যায়

`POST /auth/token/` দুই ভূমিকার জন্যই একই। রেসপন্সের
`user.role` আর `user.vendor.status` দেখে ফ্রন্টএন্ড ঠিক করে:

| role | vendor.status | যেখানে যায় |
|------|---------------|-------------|
| customer | — | হোম / আগের পাতা |
| vendor | `pending` | অনুমোদনের অপেক্ষায় পাতা |
| vendor | `approved` | `/vendor` ড্যাশবোর্ড |
| vendor | `suspended` | স্থগিত বার্তা |

### অ্যাডমিন কীভাবে অনুমোদন দেবেন

**সহজ পথ — React অ্যাডমিন প্যানেল:** <http://localhost:5173/admin/vendors>
→ অপেক্ষমাণ দোকান → **যাচাই করুন** → NID-র ছবি দেখে **অনুমোদন দিন**।
রোজকার কাজের জন্য এটাই ব্যবহার করবেন।

অ্যাডমিন অ্যাকাউন্ট বানাতে `createsuperuser` চালান — ওটাই `is_staff`
ইউজার তৈরি করে, আর সেই অ্যাকাউন্ট দিয়ে সাইটে লগইন করলেই `/admin` খুলে যায়।

**Django admin** (<http://127.0.0.1:8000/django-admin/>) রাখা হয়েছে
অস্বাভাবিক কাজের জন্য — সরাসরি ডেটা সংশোধন, বাল্ক অ্যাকশন, ডিবাগিং।
সেখানেও দোকান বেছে নিয়ে **“নির্বাচিত দোকান অনুমোদন করুন”** অ্যাকশন আছে।

কমান্ড লাইন থেকেও করা যায়:

```bash
.venv\Scripts\python.exe manage.py shell -c "from apps.vendors.models import Vendor; v=Vendor.objects.get(owner__phone='01899887766'); v.status='approved'; v.is_verified=True; v.save(); print(v.shop_name, 'অনুমোদিত')"
```

> **দোকানের URL:** বাংলা নাম ASCII slug-এ খালি হয়ে যায়, তাই ফোনের শেষ
> ৪ ডিজিট দিয়ে slug বানানো হয় — `shop-9977`। অ্যাডমিন থেকে ইচ্ছেমতো
> বদলে দেওয়া যায়।

---

## ৪. কাঠামো

```
backend/
├── config/            সেটিংস, URL, WSGI
│   └── settings.py      ← ব্যবসার সব নিয়ম MARKETPLACE ডিকশনারিতে
├── common/            সবার জন্য: base model, pagination, permission
└── apps/
    ├── accounts/      User (মোবাইল দিয়ে লগইন), Address
    ├── vendors/       Vendor, VendorKYC + পুরো ভেন্ডর প্যানেল (panel.py)
    ├── catalog/       Category, Product, Variant, Review, Banner
    ├── promotions/    Coupon
    ├── orders/        Order → VendorOrder → OrderItem
    │   └── services.py  ← 💡 টাকার সব হিসাব এখানে
    └── payouts/       LedgerEntry, Payout
```

---

## ৫. মাল্টি-ভেন্ডরের তিনটা মূল সিদ্ধান্ত

### ৫.১ অর্ডার তিন স্তরে

```
Order            ক্রেতার কাছে একটাই অর্ডার, একবার পেমেন্ট
  └── VendorOrder  প্রতি দোকানের আলাদা পার্সেল — নিজস্ব স্ট্যাটাস, কুরিয়ার, টাকা
        └── OrderItem
```

মূল `Order`-এ কোনো `status` কলাম **নেই**। এক দোকান ডেলিভারি করেছে আর
আরেকজন করেনি — এমন অবস্থায় একটামাত্র কলামে সত্যিটা লেখা যায় না। তাই
`Order.derived_status` পার্সেলগুলো থেকে হিসাব করে বের করে।

### ৫.২ ব্যালেন্স কলাম নয়, লেজার

ভেন্ডরের টাকা কোনো কলামে জমা থাকে না। প্রতিটা লেনদেন একটা
`LedgerEntry` — বিক্রি (+), কমিশন (−), রিফান্ড (−)। ব্যালেন্স = যোগফল।

পে-আউট দেওয়ার সময় ওই এন্ট্রিগুলোতে `payout` বসিয়ে দেওয়া হয়, তাই একই
টাকা দুইবার তোলা অসম্ভব। আর `release_at` ফিল্ডটা ডেলিভারির
৭ দিন পরের সময় ধরে রাখে — ওই সময়টা ক্রেতার রিটার্নের জন্য।

### ৫.৩ স্টক লক

```python
locked = ProductVariant.objects.select_for_update().get(pk=variant.pk)
if locked.stock < quantity:
    raise OutOfStock(...)
locked.stock -= quantity
```

এটা ছাড়া শেষ ১টা পণ্যে দুইজন একসাথে অর্ডার করলে দুজনেরই সফল হয়ে স্টক
ঋণাত্মক হয়ে যাবে। পুরো `place_order()` একটাই `transaction.atomic`-এ।

---

## ৬. নিরাপত্তার একটাই নিয়ম

ভেন্ডর প্যানেলের কোনো ভিউ **কখনো** URL বা query param থেকে vendor আইডি
নেয় না:

```python
def get_queryset(self):
    return VendorOrder.objects.filter(vendor=self.request.user.vendor)   # ✅

    # ❌ কখনো নয় — একজন ভেন্ডর অন্যজনের আইডি বসিয়ে সব দেখে ফেলবে
    # return VendorOrder.objects.filter(vendor_id=self.request.GET["vendor"])
```

একইভাবে ক্রেতার অর্ডার সবসময় `filter(customer=request.user)`।

---

## ৭. ব্যবসার নিয়ম বদলানো

সব `config/settings.py` → `MARKETPLACE`-এ:

```python
"DEFAULT_COMMISSION_RATE": Decimal("8"),
"COMMISSION_BY_CATEGORY": {"electronics": 5, "beauty": 12, ...},
"SHIPPING_INSIDE_DHAKA": Decimal("60"),
"SHIPPING_OUTSIDE_DHAKA": Decimal("120"),
"SHIPPING_EXTRA_VENDOR_MULTIPLIER": Decimal("0.5"),
"FREE_SHIPPING_THRESHOLD": Decimal("2000"),
"PAYOUT_HOLD_DAYS": 7,
```

> ⚠️ এই মানগুলো ফ্রন্টএন্ডের `../src/config.js` → `RULES`-এর সাথে মিলিয়ে
> রাখতে হবে। না মিললে ক্রেতা কার্টে এক টাকা দেখবে, চেকআউটে আরেক।

---

## ৮. PostgreSQL-এ যাওয়া

```bash
# requirements.txt এ psycopg লাইনটা চালু করে
.venv\Scripts\python.exe -m pip install "psycopg[binary]"
```

`.env`:

```bash
DB_ENGINE=django.db.backends.postgresql
DB_NAME=shopbazar
DB_USER=postgres
DB_PASSWORD=your-password
DB_HOST=127.0.0.1
DB_PORT=5432
```

তারপর `migrate` আর `seed` আবার চালান।

---

## ৯. এখনো যা বাকি

সচেতনভাবে বাদ রাখা — এগুলোর জন্য বাইরের সার্ভিসের অ্যাকাউন্ট লাগে:

| কাজ | কোথায় বসবে |
|-----|-------------|
| আসল OTP পাঠানো | `accounts/views.py` → `VerifyOtpView` |
| SSLCommerz পেমেন্ট + ওয়েবহুক | নতুন `apps/payments/` |
| কুরিয়ার API (পাঠাও/স্টেডফাস্ট) | `vendors/panel.py` → `_advance()` এর shipped অংশে |
| ইমেইল/SMS নোটিফিকেশন | Celery টাস্ক হিসেবে |
| ছবি S3/Cloudinary-তে | `settings.py` → `DEFAULT_FILE_STORAGE` |

সবগুলোর জন্য জায়গা আর কমেন্ট কোডে রাখা আছে।

---

## ১০. লাইভে যাওয়ার আগে

- [ ] `DJANGO_SECRET_KEY` বদলান, `DJANGO_DEBUG=False` করুন
- [ ] `DJANGO_ALLOWED_HOSTS` ও `CORS_ALLOWED_ORIGINS`-এ আসল ডোমেইন দিন
- [ ] PostgreSQL-এ যান
- [ ] `python manage.py collectstatic`, nginx দিয়ে `static/` ও `media/` সার্ভ করুন
- [ ] gunicorn/uvicorn দিয়ে চালান, `runserver` নয়
- [ ] `media/` ফোল্ডার আর ডেটাবেস একসাথে ব্যাকআপ নিন — NID ছবিগুলো ওখানেই
