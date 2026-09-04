# ---------------------------------------------------------------- ব্যাকএন্ড
# Django + Gunicorn।  বানাতে:  docker compose build backend

FROM python:3.13-slim

# .pyc ফাইল লিখে ইমেজ বড় করার মানে নেই, আর আনবাফারড আউটপুট না দিলে
# docker logs-এ প্রিন্ট দেরিতে আসে
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# requirements আগে কপি করা হয় যাতে কোড বদলালেও pip install লেয়ারটা
# ক্যাশ থেকে আসে — প্রতিবার নতুন করে ডাউনলোড হয় না
COPY requirements.txt requirements-prod.txt ./
RUN pip install -r requirements-prod.txt

COPY . .

# উইন্ডোজ থেকে কপি হলে entrypoint-এ CRLF থাকতে পারে; তাহলে Linux
# ": not found" বলে থেমে যায়। তাই কপি করার পরেই ঠিক করে নেওয়া হয়।
RUN sed -i 's/$//' /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# root হিসেবে চালালে কনটেইনার ভেঙে বেরোনো সহজ হয়ে যায়
RUN useradd --create-home --uid 1000 app \
    && mkdir -p /app/media /app/staticfiles /app/logs \
    && chown -R app:app /app
USER app

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]

# workers: (CPU × 2 + 1) সাধারণ নিয়ম। ছোট VPS-এ ৩ যথেষ্ট।
CMD ["gunicorn", "config.wsgi:application", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "3", \
     "--timeout", "60", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
