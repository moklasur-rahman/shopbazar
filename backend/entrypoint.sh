#!/bin/sh
# কনটেইনার চালু হলে প্রতিবার যা করা হয়।
#
# মাইগ্রেশন এখানে চালানো হয় (ইমেজ বানানোর সময় নয়) কারণ তখন ডেটাবেস
# থাকে না। collectstatic-ও এখানে — WhiteNoise ম্যানিফেস্ট ছাড়া
# DEBUG=False-এ admin/Swagger-এর CSS আসে না।
set -e

echo "==> migrate"
python manage.py migrate --noinput

echo "==> collectstatic"
python manage.py collectstatic --noinput --clear >/dev/null

# --------------------------------------------------------------- superuser
# পাসওয়ার্ড .env.docker থেকে আসে — এখানে কোনো ডিফল্ট পাসওয়ার্ড রাখা হয়নি
# ইচ্ছে করেই। ডিফল্ট থাকলে অনেকে সেটা বদলাতে ভুলে যান, আর লাইভ সাইটে
# পরিচিত পাসওয়ার্ডের অ্যাডমিন থাকার চেয়ে বড় ঝুঁকি কম আছে।
if [ -n "$DJANGO_SUPERUSER_PASSWORD" ] && [ -n "$DJANGO_SUPERUSER_PHONE" ]; then
  echo "==> superuser ($DJANGO_SUPERUSER_PHONE)"
  # আগে থেকে থাকলে Django নিজেই "already exists" বলে থামে — সেটা সমস্যা নয়
  python manage.py createsuperuser --noinput 2>/dev/null \
    && echo "    তৈরি হয়েছে" \
    || echo "    আগে থেকেই আছে, কিছু করা হয়নি"
fi

# ------------------------------------------------------------------- seed
# একদম খালি ডেটাবেসে ডেমো পণ্য বসানো। এটা না থাকলে প্রথমবার
# `docker compose up` করে ফাঁকা সাইট দেখে মনে হতো কিছু ভেঙে গেছে।
#
# শর্তটা "খালি হলে তবেই" — তাই দ্বিতীয়বার চালু করলে আপনার আসল ডেটার
# উপর ডেমো ডেটা বসে যাবে না।
if [ "$SEED_ON_EMPTY" = "true" ]; then
  if python manage.py shell -c "
from apps.catalog.models import Product
import sys
sys.exit(0 if Product.objects.exists() else 1)
" 2>/dev/null; then
    echo "==> seed: ডেটা আছে, বাদ দেওয়া হলো"
  else
    echo "==> seed: ডেটাবেস খালি, ডেমো ডেটা বসানো হচ্ছে"
    python manage.py seed --password "${SEED_PASSWORD:-1234}"

    if [ -z "$SEED_PASSWORD" ]; then
      echo ""
      echo "    ****************************************************"
      echo "    * সতর্কতা: ডেমো ক্রেতা ও বিক্রেতার পাসওয়ার্ড '1234'  *"
      echo "    * ইন্টারনেটে খোলা সার্ভারে এভাবে চালাবেন না।         *"
      echo "    * .env.docker-এ SEED_ON_EMPTY=false দিন, অথবা      *"
      echo "    * SEED_PASSWORD দিয়ে নিজের পাসওয়ার্ড বসান।          *"
      echo "    ****************************************************"
      echo ""
    fi
  fi
fi

echo "==> gunicorn"
exec "$@"
