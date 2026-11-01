"""Django settings for Truck Pilot.

Every secret comes from the environment. Locally, values are read from the
repo-root `.env.local` (never committed); on Vercel they are project env vars.
"""

import os
from pathlib import Path

from truckpilot.env import database_from_url, env_list, load_env_file

BASE_DIR = Path(__file__).resolve().parent.parent
load_env_file(BASE_DIR.parent / ".env.local")

# True on a Vercel deployment (preview or production); `vercel dev` reports "development".
ON_VERCEL = os.environ.get("VERCEL_ENV") in {"preview", "production"}

SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]
DEBUG = os.environ.get("DEBUG", "0").lower() in {"1", "true"}

ALLOWED_HOSTS = env_list("ALLOWED_HOSTS")
if os.environ.get("VERCEL_URL"):
    # The deployment's own address (set by Vercel), so a preview answers on its URL.
    ALLOWED_HOSTS.append(os.environ["VERCEL_URL"])
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS")

INSTALLED_APPS: list[str] = []

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "truckpilot.urls"
WSGI_APPLICATION = "truckpilot.wsgi.application"

# Neon pooled connection (PgBouncer, transaction mode): no persistent
# connections and no server-side cursors (architecture 3).
DATABASES = {"default": database_from_url(os.environ["DATABASE_URL"])}

# Sessions and CSRF (architecture 9). Step-10 uses signed-cookie sessions only to
# prove the HttpOnly cookie on one address; slice 4 switches to the database
# session store with a user_id column.
SESSION_ENGINE = "django.contrib.sessions.backends.signed_cookies"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = ON_VERCEL
CSRF_COOKIE_SECURE = ON_VERCEL

# Behind Vercel's proxy Django must know the request was HTTPS, or the CSRF
# Origin check refuses every POST.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
if ON_VERCEL:
    SECURE_HSTS_SECONDS = 31536000

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = False
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
