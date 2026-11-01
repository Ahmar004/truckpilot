"""Django settings for Truck Pilot.

Every secret comes from the environment. Locally, values are read from the
repo-root `.env.local` (never committed); on Vercel they are project env vars.
"""

import os
from pathlib import Path

from truckpilot.env import check_e2e_mode, database_from_url, env_flag, env_list, load_env_file

BASE_DIR = Path(__file__).resolve().parent.parent
load_env_file(BASE_DIR.parent / ".env.local")

# True on a Vercel deployment (preview or production); `vercel dev` reports "development".
ON_VERCEL = os.environ.get("VERCEL_ENV") in {"preview", "production"}

SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]
DEBUG = env_flag("DEBUG")

# Adds POST /api/test/sign-in for end-to-end tests; refused unless DEBUG is on locally.
E2E_MODE = env_flag("E2E_MODE")
check_e2e_mode(e2e=E2E_MODE, debug=DEBUG, on_vercel=ON_VERCEL)

# Public by design (it is also in the browser build); empty when unset.
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")

# Provider keys stay on the server (spec 12); empty when unset, so a call then fails as an
# unavailable provider.
TOMTOM_API_KEY = os.environ.get("TOMTOM_API_KEY", "")
GEOAPIFY_API_KEY = os.environ.get("GEOAPIFY_API_KEY", "")

ALLOWED_HOSTS = env_list("ALLOWED_HOSTS")
if os.environ.get("VERCEL_URL"):
    # The deployment's own address (set by Vercel), so a preview answers on its URL.
    ALLOWED_HOSTS.append(os.environ["VERCEL_URL"])
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS")

# No django.contrib.sessions or admin: the session model is our own (accounts.Session).
INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "accounts",
    "usage",
    "weather",
]
AUTH_USER_MODEL = "accounts.User"

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "truckpilot.urls"
WSGI_APPLICATION = "truckpilot.wsgi.application"

# Neon pooled connection (PgBouncer, transaction mode): no persistent
# connections and no server-side cursors (architecture 3).
DATABASES = {"default": database_from_url(os.environ["DATABASE_URL"])}

# Sessions and CSRF (architecture 9). Database sessions with a user_id column; 14 days
# (Django's default).
SESSION_ENGINE = "accounts.session_store"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = "Lax"
# A failed CSRF check answers JSON 403 {"code": "csrf_failed"}.
CSRF_FAILURE_VIEW = "api.errors.csrf_failure"
SESSION_COOKIE_SECURE = ON_VERCEL
CSRF_COOKIE_SECURE = ON_VERCEL

# Behind Vercel's proxy Django must know the request was HTTPS, or the CSRF
# Origin check refuses every POST.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
# HSTS only on a real deployment, never on local http (architecture 11).
if ON_VERCEL and not DEBUG:
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = False
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# httpx logs every request URL at INFO, and a provider key is in that URL, so keep its
# loggers at WARNING (architecture 10).
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "loggers": {
        "httpx": {"level": "WARNING"},
        "httpcore": {"level": "WARNING"},
    },
}

# Sentry (architecture 10): only when a DSN is set. No PII; request data and URL query strings
# (they can hold provider keys) are scrubbed in core/sentry.py.
SENTRY_DSN = os.environ.get("SENTRY_DSN", "")
if SENTRY_DSN:
    import sentry_sdk

    from core.sentry import before_breadcrumb, before_send

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        send_default_pii=False,
        before_send=before_send,
        before_breadcrumb=before_breadcrumb,
        environment=os.environ.get("VERCEL_ENV", "development"),
    )
