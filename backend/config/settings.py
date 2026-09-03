"""
শপবাজার ব্যাকএন্ড সেটিংস।

ব্যবসার নিয়মগুলো (কমিশন, ডেলিভারি চার্জ, হোল্ড পিরিয়ড) নিচের MARKETPLACE
ডিকশনারিতে — ফ্রন্টএন্ডের src/config.js এর RULES এর হুবহু প্রতিচ্ছবি।
দুই জায়গার মান এক না থাকলে হিসাব মিলবে না, তাই একটা বদলালে অন্যটাও বদলাবেন।
"""

from datetime import timedelta
from decimal import Decimal
from pathlib import Path

from dotenv import load_dotenv
import os

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env(key, default=""):
    return os.environ.get(key, default)


def env_bool(key, default=False):
    return str(env(key, str(default))).strip().lower() in {"1", "true", "yes", "on"}


def env_list(key, default=""):
    raw = env(key, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


# ------------------------------------------------------------------ core

SECRET_KEY = env("DJANGO_SECRET_KEY", "dev-only-insecure-key")
DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # তৃতীয় পক্ষ
    "rest_framework",
    "django_filters",
    "corsheaders",
    "drf_spectacular",
    "drf_spectacular_sidecar",  # Swagger UI-র ফাইলগুলো সাথে আসে, CDN লাগে না
    # নিজের অ্যাপ
    "apps.accounts",
    "apps.vendors",
    "apps.catalog",
    "apps.promotions",
    "apps.orders",
    "apps.payouts",
    "apps.staff",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",  # সবার উপরে থাকতে হবে
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

# অ্যাডমিনের ঠিকানা — শেষে স্ল্যাশ থাকবে, শুরুতে নয়। যেমন "django-admin/"
ADMIN_URL = env("DJANGO_ADMIN_URL", "django-admin/").strip("/") + "/"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# -------------------------------------------------------------- database

if env("DB_ENGINE", "django.db.backends.sqlite3").endswith("sqlite3"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": env("DB_ENGINE"),
            "NAME": env("DB_NAME", "shopbazar"),
            "USER": env("DB_USER", "postgres"),
            "PASSWORD": env("DB_PASSWORD", ""),
            "HOST": env("DB_HOST", "127.0.0.1"),
            "PORT": env("DB_PORT", "5432"),
        }
    }

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        # ৮ অক্ষর — শিল্পের সাধারণ ন্যূনতম। ডেমো অ্যাকাউন্টের ছোট পাসওয়ার্ড
        # `seed` কমান্ড সরাসরি set_password() দিয়ে বসায়, তাই ওগুলোতে এই
        # নিয়ম খাটে না; আসল রেজিস্ট্রেশনে খাটে।
        "OPTIONS": {"min_length": 8},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ------------------------------------------------------------- i18n/time

LANGUAGE_CODE = "bn"
TIME_ZONE = "Asia/Dhaka"
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------- static/media

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------- DRF

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.AllowAny",),
    "DEFAULT_PAGINATION_CLASS": "common.pagination.StandardPagination",
    # ফ্রন্টএন্ডের RULES.pageSize এর সমান রাখুন
    "PAGE_SIZE": 12,
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
    ) if not DEBUG else (
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ),
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.ScopedRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "auth": "20/min",      # লগইন ও রেজিস্ট্রেশন
        "checkout": "60/min",  # কোট ও অর্ডার
    },
    # OpenAPI স্কিমা — DRF তাদের নিজস্ব জেনারেটর বাতিল করে এখন
    # drf-spectacular সুপারিশ করে
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "শপবাজার API",
    "DESCRIPTION": (
        "বাংলাদেশের মাল্টি-ভেন্ডর মার্কেটপ্লেসের REST API।\n\n"
        "**তিন ধরনের ব্যবহারকারী:**\n"
        "- ক্রেতা — ক্যাটালগ, কার্ট, অর্ডার\n"
        "- বিক্রেতা (`/vendor/…`) — নিজের পণ্য ও পার্সেল\n"
        "- প্ল্যাটফর্ম অ্যাডমিন (`/admin/…`) — অনুমোদন, মডারেশন, রিপোর্ট\n\n"
        "**অথেনটিকেশন:** JWT। `/auth/token/` এ মোবাইল ও পাসওয়ার্ড পাঠিয়ে "
        "টোকেন নিন, তারপর `Authorization: Bearer <access>` হেডারে দিন।\n\n"
        "**মাল্টি-ভেন্ডরের মূল কথা:** এক `Order` এর ভেতরে প্রতিটি দোকানের "
        "জন্য আলাদা `VendorOrder` (পার্সেল) থাকে — নিজস্ব স্ট্যাটাস, "
        "ডেলিভারি চার্জ আর কমিশনসহ।"
    ),
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SWAGGER_UI_DIST": "SIDECAR",
    "SWAGGER_UI_FAVICON_HREF": "SIDECAR",
    "REDOC_DIST": "SIDECAR",
    "COMPONENT_SPLIT_REQUEST": True,
    "TAGS": [
        {"name": "auth", "description": "রেজিস্ট্রেশন, লগইন, প্রোফাইল"},
        {"name": "catalog", "description": "ক্যাটাগরি, পণ্য, রিভিউ, ব্যানার"},
        {"name": "vendors", "description": "দোকানের পাবলিক তথ্য"},
        {"name": "checkout", "description": "কোট ও কুপন যাচাই"},
        {"name": "orders", "description": "অর্ডার তৈরি ও ট্র্যাকিং"},
        {"name": "vendor-panel", "description": "বিক্রেতার নিজের প্যানেল"},
        {"name": "admin", "description": "প্ল্যাটফর্ম অ্যাডমিন"},
    ],
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=14),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": False,
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

# ---------------------------------------------------------------- CORS

CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
)
CORS_ALLOW_CREDENTIALS = True

# ------------------------------------------------------------- নিরাপত্তা

# এই সেটিংগুলো শুধু DEBUG=False হলে চালু হয়।
# লোকাল ডেভেলপমেন্টে চালু করলে SSL রিডাইরেক্ট আর secure-only কুকির কারণে
# http://localhost এ কিছুই কাজ করত না।
#
# `python manage.py check --deploy` চালিয়ে যাচাই করুন — শূন্য ওয়ার্নিং আসা উচিত।

SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

if not DEBUG:
    # HTTP এলে HTTPS-এ পাঠাও
    SECURE_SSL_REDIRECT = True

    # ব্রাউজারকে বলে রাখা: এই ডোমেইনে এক বছর শুধু HTTPS-ই ব্যবহার করবে।
    # ⚠️ একবার চালু করলে ফেরত আসা কঠিন — ডোমেইনে SSL ঠিকমতো বসার পরেই দিন।
    SECURE_HSTS_SECONDS = 31536000  # ১ বছর
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

    # কুকি শুধু HTTPS-এ যাবে, আর JavaScript পড়তে পারবে না
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    CSRF_COOKIE_SECURE = True
    CSRF_COOKIE_HTTPONLY = True

    # nginx/লোড ব্যালান্সারের পেছনে থাকলে Django যেন বোঝে আসল রিকোয়েস্ট HTTPS
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

    CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS", "")

# ------------------------------------------------------------------ লগিং

# Python-এর logging.config সব হ্যান্ডলার তৈরি করে, কোনো লগার সেটা
# ব্যবহার করুক বা না করুক। তাই ফোল্ডারটা সবসময় থাকতে হবে — নাহলে
# DEBUG মোডেও "Unable to configure handler 'file'" এসে সার্ভার চালুই হয় না।
LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(exist_ok=True)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {name} — {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "verbose"},
        # লাইভে ফাইলেও রাখা হয়, যাতে সমস্যা হলে খুঁজে দেখা যায়
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": LOG_DIR / "app.log",
            "maxBytes": 5 * 1024 * 1024,
            "backupCount": 5,
            "formatter": "verbose",
            "encoding": "utf-8",   # বাংলা লগ যেন ভাঙে না
            "delay": True,         # প্রথম লেখার আগে ফাইল খোলা হবে না
        },
    },
    "root": {
        "handlers": ["console"] if DEBUG else ["console", "file"],
        "level": "DEBUG" if DEBUG else "INFO",
    },
    "loggers": {
        # অর্ডার আর টাকার হিসাবের লগ আলাদা করে রাখা — সমস্যা হলে এখানেই খুঁজবেন
        "apps.orders": {"level": "INFO"},
        "apps.payouts": {"level": "INFO"},
        "django.security": {"level": "WARNING"},
    },
}

# --------------------------------------------------- ব্যবসার নিয়ম

MARKETPLACE = {
    # প্ল্যাটফর্মের ডিফল্ট কমিশন (%) — ভেন্ডরে ওভাররাইড হতে পারে
    "DEFAULT_COMMISSION_RATE": Decimal("8"),

    # ক্যাটাগরি অনুযায়ী কমিশন (%)
    "COMMISSION_BY_CATEGORY": {
        "electronics": Decimal("5"),
        "books": Decimal("6"),
        "grocery": Decimal("7"),
        "home": Decimal("9"),
        "kids": Decimal("9"),
        "fashion": Decimal("10"),
        "sports": Decimal("10"),
        "beauty": Decimal("12"),
    },

    # ডেলিভারি চার্জ (৳)
    "SHIPPING_INSIDE_DHAKA": Decimal("60"),
    "SHIPPING_OUTSIDE_DHAKA": Decimal("120"),
    # প্রথম পার্সেল পুরো চার্জ, পরেরগুলো এই হারে
    "SHIPPING_EXTRA_VENDOR_MULTIPLIER": Decimal("0.5"),
    # এই টাকার উপরে কিনলে ওই ভেন্ডরের পার্সেল ফ্রি
    "FREE_SHIPPING_THRESHOLD": Decimal("2000"),

    # ঢাকা সিটির ভেতরে কি না — এই জেলার নামে মিলিয়ে দেখা হয়
    "DHAKA_DISTRICT": "ঢাকা",

    # ডেলিভারির পর কত দিন টাকা হোল্ডে থাকবে (রিটার্ন উইন্ডো)
    "PAYOUT_HOLD_DAYS": 7,

    # কার্টে একই আইটেমের সর্বোচ্চ সংখ্যা
    "MAX_QTY_PER_ITEM": 10,

    # স্টক এর নিচে নামলে "কম স্টক" ধরা হবে
    "LOW_STOCK_THRESHOLD": 15,
}
