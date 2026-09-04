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

### অ্যাডমিন অ্যাকাউন্ট

কনটেইনার চালু থাকা অবস্থায় আরেকটা টার্মিনালে:

```bash
docker compose exec backend python manage.py createsuperuser
```

তারপর `http://localhost:8080/django-admin/` — অথবা React-এর নিজের
অ্যাডমিন প্যানেল `http://localhost:8080/admin`।

### ডেমো ডেটা

```bash
docker compose exec backend python manage.py seed
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

**ডেটাবেসের ব্যাকআপ**

```bash
docker compose exec db pg_dump -U shopbazar shopbazar > backup.sql
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
