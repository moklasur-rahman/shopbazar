#!/bin/sh
# কনটেইনার চালু হলে প্রতিবার যা করা হয়।
#
# মাইগ্রেশন এখানে চালানো হয় (ইমেজ বানানোর সময় নয়) কারণ তখন ডেটাবেস
# থাকে না। collectstatic-ও এখানে — WhiteNoise ম্যানিফেস্ট ছাড়া
# DEBUG=False-এ admin/Swagger-এর CSS আসে না।
set -e

echo "-> migrate"
python manage.py migrate --noinput

echo "-> collectstatic"
python manage.py collectstatic --noinput --clear

echo "-> starting server"
exec "$@"
