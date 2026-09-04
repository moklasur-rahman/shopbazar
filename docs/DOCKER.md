# Docker দিয়ে পুরো সাইট চালানো

তিনটা আলাদা জিনিস (React, Django, PostgreSQL) নিজের মেশিনে আলাদা করে
বসানোর বদলে এক কমান্ডে সব চালু করা যায়। নতুন কেউ প্রজেক্টে এলে তার
মেশিনে Python বা Node কিছুই না থাকলেও চলবে — শুধু Docker লাগবে।

---

## এক নজরে

| কনটেইনার | কী করে | পোর্ট |
|---|---|---|
| `db` | PostgreSQL ১৭ | ভেতরে ৫৪৩২ (বাইরে খোলা নেই) |
| `backend` | Django + Gunicorn | ভেতরে ৮০০০ |
| `web` | React বিল্ড + nginx, সেই সাথে API-র প্রক্সি | **৮০৮০ → বাইরে** |

ব্রাউজার শুধু `web`-এর সাথে কথা বলে। `/api/…` এলে nginx সেটা `backend`-এ
পাঠিয়ে দেয়। ফলে সবকিছু একটাই অরিজিনে — CORS-এর ঝামেলা নেই।

```
ব্রাউজার ──▶ localhost:8080 (nginx)
                  ├── /            → React-এর index.html
                  ├── /api/…       → backend:8000  (Django)
                  ├── /static/…    → backend:8000  (WhiteNoise)
                  └── /media/…     → shared ভলিউম থেকে সরাসরি
```

---

## প্রথমবার চালানো

```bash
cd D:\tajproject\marketplace

# ১. এনভায়রনমেন্ট ফাইল বানান
copy .env.docker.example .env.docker        # Linux/Mac: cp

# ২. .env.docker খুলে দুইটা মান বদলান:
#      DJANGO_SECRET_KEY  — ৫০ অক্ষরের এলোমেলো কিছু
#      DB_PASSWORD        — নিজের পাসওয়ার্ড

# ৩. চালু করুন
docker compose up --build
```

প্রথমবার ৩–৫ মিনিট লাগে (ইমেজ নামানো + npm install)। পরেরবার কয়েক সেকেন্ড।

তারপর **http://localhost:8080**

### প্রথমবার চালু হলে যা নিজে থেকেই হয়

কনটেইনার চালু হওয়ার সময় `backend/entrypoint.sh` ধাপে ধাপে করে:

| ধাপ | কখন হয় |
|---|---|
| `migrate` | সবসময় |
| `collectstatic` | সবসময় (নাহলে admin/Swagger-এর CSS আসে না) |
| অ্যাডমিন অ্যাকাউন্ট | `DJANGO_SUPERUSER_PASSWORD` দেওয়া থাকলে, আর আগে না থাকলে |
| ডেমো ডেটা (`seed`) | `SEED_ON_EMPTY=true` **এবং** ডেটাবেস একদম খালি হলে |

তাই প্রথমবারই ৪১টা পণ্য, ৮টা দোকান আর একটা কাজের অ্যাডমিন অ্যাকাউন্ট
নিয়ে সাইটটা চালু হয় — ফাঁকা পাতা দেখে "কিছু ভেঙে গেল নাকি" ভাবতে হয় না।

দ্বিতীয়বার থেকে seed আর চলে না, তাই আপনার আসল ডেটার উপর ডেমো ডেটা
কখনো বসবে না।

লগে দেখতে পাবেন:

```
backend-1  | ==> migrate
backend-1  | ==> collectstatic
backend-1  | ==> superuser (01700000000)
backend-1  | ==> seed: ডেটাবেস খালি, ডেমো ডেটা বসানো হচ্ছে
backend-1  | ==> gunicorn
```

### অ্যাডমিন হিসেবে ঢোকা

`.env.docker`-এ যে নম্বর ও পাসওয়ার্ড দিয়েছেন সেটাই:

- React অ্যাডমিন প্যানেল → http://localhost:8080/admin
- Django admin → http://localhost:8080/django-admin/

পাসওয়ার্ড বদলাতে বা ভুলে গেলে:

```bash
docker compose exec backend python manage.py changepassword 01700000000
```

`.env.docker`-এ পাসওয়ার্ড না দিলে অ্যাডমিন তৈরি হয় না; তখন নিজে বানান:

```bash
docker compose exec backend python manage.py createsuperuser
```

---

## রোজকার কমান্ড

```bash
docker compose up -d            # ব্যাকগ্রাউন্ডে চালু
docker compose logs -f backend  # লগ দেখা
docker compose ps               # কোনটা চলছে
docker compose down             # বন্ধ (ডেটা থাকে)
docker compose down -v          # বন্ধ + ডেটাবেস ও ছবি মুছে ফেলা ⚠️
```

কোড বদলালে:

```bash
docker compose up -d --build
```

> ⚠️ ফ্রন্টএন্ডের কোড বিল্ডের সময়ই ইমেজে ঢুকে যায়। তাই React-এ কিছু
> বদলালে `--build` ছাড়া কনটেইনার রিস্টার্ট করে লাভ নেই।
> দ্রুত কাজ করার জন্য ডেভেলপমেন্টে `npm run dev` ব্যবহার করাই ভালো —
> Docker মূলত "লাইভের মতো" অবস্থায় যাচাই করার জন্য।

---

## সমস্যা হলে

### `port is already allocated` / `bind: address already in use`

অন্য কোনো প্রোগ্রাম ৮০৮০ পোর্টটা আগেই দখল করে আছে — সাধারণত
**XAMPP/Apache**, Jenkins, বা অন্য কোনো প্রজেক্ট।

কে দখল করেছে দেখতে (PowerShell):

```powershell
Get-NetTCPConnection -LocalPort 8080 -State Listen | ForEach-Object { Get-Process -Id $_.OwningProcess }
```

দুইটা উপায় —

**১. অন্য পোর্টে চালান** (সহজ, ওই প্রোগ্রাম বন্ধ করতে হয় না):

```powershell
$env:WEB_PORT="9090"; docker compose up
```

তারপর <http://localhost:9090>। প্রতিবার লিখতে না চাইলে রিপোর রুটে
একটা `.env` ফাইল বানিয়ে তাতে লিখুন:

```
WEB_PORT=9090
```

**২. ওই প্রোগ্রামটা বন্ধ করুন** — XAMPP হলে কন্ট্রোল প্যানেল থেকে
Apache **Stop**।

### সাইট খোলে কিন্তু অন্য কিছু দেখায়

উপরের একই কারণ — আপনি আসলে XAMPP-এর পাতা দেখছেন, আমাদের nginx-এর নয়।
পোর্ট বদলে দেখুন।

### `docker compose` বলছে daemon চলছে না

Docker Desktop চালু হয়নি বা এখনো বুট হচ্ছে। ট্রে-আইকনের তিমিটা স্থির
না হওয়া পর্যন্ত অপেক্ষা করুন।

### সাইট খালি — কোনো পণ্য নেই

`.env.docker`-এ `SEED_ON_EMPTY=true` আছে কি না দেখুন। না থাকলে হাতে:

```bash
docker compose exec backend python manage.py seed
```

### লগ দেখা

```bash
docker compose logs -f backend    # Django
docker compose logs -f web        # nginx
docker compose logs -f db         # PostgreSQL
```

---

## যা মনে রাখতে হবে

**`DJANGO_HTTPS=False` কেন**
লাইভ সার্ভারে Django-র নিরাপত্তা সেটিংগুলো (SSL রিডাইরেক্ট, HSTS,
Secure কুকি) চালু থাকা উচিত। কিন্তু `http://localhost:8080`-এ SSL নেই —
চালু থাকলে প্রতিটি রিকোয়েস্ট `https://localhost:8080`-এ রিডাইরেক্ট হয়ে
সাইটটাই খুলত না। ডোমেইন আর সার্টিফিকেট বসানোর পর এটা `True` করুন।

**অ্যাডমিনের ঠিকানা বদলালে**
`.env.docker`-এ `DJANGO_ADMIN_URL` বদলালে `nginx.conf`-এর
`location ~ ^/(api|static|django-admin)/` লাইনেও একই নাম বসাতে হবে,
নইলে nginx ওই পথটা চিনবে না আর ৪০৪ দেবে।

**আপলোড করা ছবি**
`media` নামের একটা শেয়ার্ড ভলিউমে থাকে — `backend` লেখে, `nginx`
read-only হিসেবে পড়ে। `docker compose down -v` দিলে এগুলোও মুছে যায়।

---

## ব্যাকআপ ও ফিরিয়ে আনা

ডেটাবেস আর আপলোড করা ছবি — দুইটাই লাগবে। ছবি ছাড়া ডেটাবেস ফেরালে
পণ্যের ছবি আর NID-র ছবি সব হারিয়ে যাবে।

**ব্যাকআপ নেওয়া**

```bash
docker compose exec -T backend python manage.py dumpdata   --exclude contenttypes --exclude auth.permission   --exclude sessions.session --exclude admin.logentry   --indent 2 > backup.json

docker compose exec -T backend tar cf - -C /app media > media.tar
```

> ⚠️ `backup.json`-এ পাসওয়ার্ডের হ্যাশ আর NID-র তথ্য থাকে। এটা কখনো
> গিটে কমিট করবেন না — `.gitignore`-এ `dump*.json` নিয়মটা সেজন্যই আছে।

**ফিরিয়ে আনা**

```bash
docker compose exec -T backend python manage.py flush --noinput
docker compose exec -T backend python manage.py loaddata --format=json - < backup.json
docker compose exec -T backend tar xf - -C /app < media.tar
```

`flush` পুরোনো সব মুছে দেয়, তাই ফেরানোর পর ঠিক ব্যাকআপের অবস্থাটাই থাকে।

**কাঁচা SQL ডাম্প চাইলে** (অন্য PostgreSQL সার্ভারে নিতে):

```bash
docker compose exec -T db pg_dump -U shopbazar shopbazar > backup.sql
```

---

## আসল সার্ভারে নেওয়ার আগে

এই compose ফাইলটা "লাইভের মতো", কিন্তু হুবহু লাইভ নয়। আসল সার্ভারে
যাওয়ার আগে যা লাগবে:

1. **ডোমেইন + HTTPS** — Caddy বা nginx + Let's Encrypt। তারপর
   `DJANGO_HTTPS=True`, আর `DJANGO_ALLOWED_HOSTS` / `CSRF_TRUSTED_ORIGINS`-এ
   আসল ডোমেইন।
2. **ছবি S3/Cloudinary-তে** — একাধিক সার্ভারে গেলে লোকাল ভলিউম আর চলবে না।
3. **ব্যাকআপ** — `pg_dump` রোজ, অন্য কোথাও রাখা।
4. **Sentry** — এরর কোথায় হচ্ছে না জানলে ঠিক করা যায় না।
5. **`docker compose logs` নয়, আসল লগ কালেক্টর** — কনটেইনার মুছলে লগও যায়।
