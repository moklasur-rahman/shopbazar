# শপবাজার — বাংলাদেশের মাল্টি-ভেন্ডর মার্কেটপ্লেস

[![CI](https://github.com/moklasur-rahman/shopbazar/actions/workflows/ci.yml/badge.svg)](https://github.com/moklasur-rahman/shopbazar/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

এক অর্ডারে একাধিক দোকানের পণ্য — সেই কাঠামোর উপর দাঁড়ানো একটা সম্পূর্ণ
মার্কেটপ্লেস। ক্রেতা, বিক্রেতা আর প্ল্যাটফর্ম অ্যাডমিন — তিনজনেরই নিজস্ব
প্যানেল। পুরো UI বাংলায়, টাকার হিসাব বাংলাদেশের নিয়মে (ঢাকার ভেতরে/বাইরে
ডেলিভারি চার্জ, ক্যাটাগরি অনুযায়ী কমিশন, ৭ দিনের পে-আউট হোল্ড)।

**React 19 · Vite 7 · Tailwind CSS 4** ⟷ **Django 5.2 · DRF · SimpleJWT · PostgreSQL**

---

## এক কমান্ডে চালু করুন

মেশিনে শুধু **Docker** থাকলেই হবে — Python, Node, PostgreSQL কিছুই বসাতে হবে না।

```bash
git clone https://github.com/moklasur-rahman/shopbazar.git
cd shopbazar
cp .env.docker.example .env.docker     # Windows: copy
docker compose up --build
```

প্রথমবার ৩–৫ মিনিট। তারপর **<http://localhost:8080>**

ডেমো ডেটা আর অ্যাডমিন অ্যাকাউন্ট বসাতে (আরেকটা টার্মিনালে):

```bash
docker compose exec backend python manage.py seed
docker compose exec backend python manage.py createsuperuser
```

বিস্তারিত — সমস্যা হলে কী দেখবেন, ব্যাকআপ, লাইভে নেওয়া: **[`docs/DOCKER.md`](docs/DOCKER.md)**

---

## ফোল্ডার

```
shopbazar/
├── frontend/          React অ্যাপ — নিজের README, Dockerfile, nginx.conf
│   ├── src/
│   │   ├── api/         আসল API ক্লায়েন্ট (client · endpoints · adapters · services)
│   │   ├── mock/        একই আকারের নকল API — ব্যাকএন্ড ছাড়াই পুরো সাইট চলে
│   │   ├── lib/         টাকার হিসাব, ফরম্যাট, বাংলাদেশের জেলা-থানা
│   │   ├── store/       Context — Auth · Cart · Toast
│   │   ├── components/  ui/ · layout/ · product/
│   │   ├── pages/       ক্রেতার পাতা + vendor/ + admin/
│   │   └── types/       TypeScript ডেটার আকার
│   └── ...
│
├── backend/           Django REST API — নিজের README
│   ├── apps/            accounts · vendors · catalog · promotions
│   │                    orders · payouts · staff
│   ├── common/          সবার কাজে লাগে এমন — permissions, pagination, utils
│   ├── config/          settings · urls
│   └── tests/           pytest
│
├── shared/            ব্যবসার নিয়মের আসল সত্য (business-rules.json)
├── docs/              Docker, Django ইন্টিগ্রেশন
├── .github/workflows/ CI
└── docker-compose.yml
```

**কেন `frontend/` আর `backend/` আলাদা:** দুইটার নিজস্ব ভাষা, নিজস্ব
নির্ভরতা, নিজস্ব Docker ইমেজ। আলাদা রাখলে একটার `node_modules` অন্যটার
বিল্ড কনটেক্সটে ঢোকে না, আর CI-তে দুইটা সমান্তরালে চলতে পারে।

---

## মূল তিনটা সিদ্ধান্ত

**১. অর্ডার তিন স্তরে** — `Order → VendorOrder → OrderItem`

মূল অর্ডারে কোনো `status` কলাম নেই। এক দোকান ডেলিভারি করেছে আর আরেকজন
করেনি — এমন অবস্থায় একটামাত্র কলামে সত্যিটা লেখা যায় না। প্রতি দোকানের
পার্সেলের নিজস্ব স্ট্যাটাস, নিজস্ব কুরিয়ার, নিজস্ব টাকা।

**২. ভেন্ডরের ব্যালেন্স কলাম নয়, লেজার**

প্রতিটা লেনদেন একটা `LedgerEntry` — বিক্রি (+), কমিশন (−), রিফান্ড (−)।
ব্যালেন্স = যোগফল। পে-আউটে এন্ট্রিগুলো বেঁধে দেওয়া হয়, তাই একই টাকা
দুইবার তোলা অসম্ভব।

**৩. ব্যবসার নিয়ম একটাই সত্য**

কমিশন আর ডেলিভারি চার্জ ফ্রন্টএন্ড-ব্যাকএন্ড দুই জায়গায় লেখা (একটা
দ্রুত দেখানোর জন্য, একটা চূড়ান্ত হিসাবের জন্য)। দুইটা আলাদা হয়ে গেলে
ক্রেতা কার্টে এক টাকা দেখবেন, চেকআউটে আরেক — তাই
[`shared/business-rules.json`](shared/business-rules.json) আসল সত্য, আর
দুই দিকের টেস্ট সেটার সাথে মিলিয়ে দেখে। ভুলে গেলে CI লাল হয়।

---

## ডেভেলপমেন্ট (Docker ছাড়া)

<table>
<tr><th>ফ্রন্টএন্ড</th><th>ব্যাকএন্ড</th></tr>
<tr><td valign="top">

```bash
cd frontend
npm install
npm run dev          # localhost:5173
```

</td><td valign="top">

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

</td></tr>
</table>

ব্যাকএন্ড ছাড়াই পুরো সাইট দেখতে চাইলে `frontend/.env`-এ
`VITE_USE_MOCK=true` — তখন ব্রাউজারের ভেতরের নকল ডেটা দিয়ে সব কাজ করে।

---

## যাচাই

| কমান্ড | কী দেখে |
|---|---|
| `cd backend && pytest` | ৯৭টি টেস্ট — টাকার হিসাব, অর্ডার, নিরাপত্তা, নিয়মের মিল |
| `cd frontend && npm test` | ৩১টি টেস্ট — টাকার হিসাব, নিয়মের মিল |
| `cd frontend && npm run lint` | ESLint |
| `cd frontend && npm run typecheck` | TypeScript |
| `cd backend && python manage.py check --deploy` | নিরাপত্তা (০ ওয়ার্নিং হওয়া উচিত) |

তিনটাই CI-তে প্রতি push আর PR-এ চলে, সাথে দুইটা Docker ইমেজের বিল্ড।

---

## API ডকুমেন্টেশন

সার্ভার চালু থাকলে **<http://localhost:8080/api/docs/>** (Swagger UI) —
৫৫টা এন্ডপয়েন্ট, ব্রাউজার থেকেই পরীক্ষা করা যায়।
ReDoc: `/api/redoc/` · কাঁচা স্কিমা: `/api/schema/`

---

## লাইসেন্স

[MIT](LICENSE)
