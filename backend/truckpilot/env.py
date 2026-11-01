"""Environment helpers for settings."""

import os
from pathlib import Path
from urllib.parse import parse_qsl, unquote, urlsplit

from django.core.exceptions import ImproperlyConfigured


def load_env_file(path: Path) -> None:
    """Read KEY=VALUE lines into os.environ without overriding real env vars."""
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        os.environ.setdefault(key.strip(), value)


def env_list(name: str) -> list[str]:
    """A comma-separated env var as a list, empty items dropped."""
    return [item.strip() for item in os.environ.get(name, "").split(",") if item.strip()]


def database_from_url(url: str) -> dict:
    """Turn a postgresql:// URL (Neon) into a Django DATABASES entry."""
    parts = urlsplit(url)
    if parts.scheme not in {"postgres", "postgresql"}:
        raise ValueError("DATABASE_URL must be a postgresql:// URL")
    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": unquote(parts.path.lstrip("/")),
        "USER": unquote(parts.username or ""),
        "PASSWORD": unquote(parts.password or ""),
        "HOST": parts.hostname or "",
        "PORT": str(parts.port or ""),
        "OPTIONS": dict(parse_qsl(parts.query)),
        "CONN_MAX_AGE": 0,
        "DISABLE_SERVER_SIDE_CURSORS": True,
    }


def env_flag(name: str) -> bool:
    """True when the env var is "1" or "true" (any case)."""
    return os.environ.get(name, "").lower() in {"1", "true"}


def check_e2e_mode(*, e2e: bool, debug: bool, on_vercel: bool) -> None:
    """Refuse to start with E2E_MODE unless DEBUG is on and this is not Vercel.

    E2E_MODE adds a test sign-in, so it must never reach production (architecture 13).
    """
    if e2e and (not debug or on_vercel):
        raise ImproperlyConfigured("E2E_MODE needs DEBUG on and cannot run on Vercel.")


NEON_HOST_MARKER = "neon.tech"


def local_database_from_url(url: str) -> dict:
    """A DATABASES entry for the local test Postgres; refuses an empty URL or a Neon host."""
    if not url.strip():
        raise ImproperlyConfigured("TEST_DATABASE_URL is empty; see docs/api-setup-guide.md")
    db = database_from_url(url)
    if NEON_HOST_MARKER in db["HOST"]:
        raise ImproperlyConfigured("TEST_DATABASE_URL must be a local database, not Neon.")
    return db
