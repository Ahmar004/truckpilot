"""Start Django for the Playwright run (architecture 13).

Uses a separate local database `truckpilot_e2e` on the same Postgres as the backend tests, never
Neon. It creates the database if missing, migrates it, then serves with E2E_MODE on (the test
sign-in plus saved provider answers). Run from `backend/`: `uv run python e2e_server.py`.
"""

import os
import sys
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import psycopg
from psycopg import sql

from truckpilot.env import load_env_file, local_database_from_url

E2E_DB = "truckpilot_e2e"
PORT = "8000"


def e2e_url(test_url: str) -> str:
    parts = urlsplit(test_url)
    return urlunsplit(parts._replace(path=f"/{E2E_DB}"))


def ensure_database(url: str) -> None:
    db = local_database_from_url(url)
    with psycopg.connect(
        dbname="postgres",
        user=db["USER"],
        password=db["PASSWORD"],
        host=db["HOST"],
        port=db["PORT"] or None,
        autocommit=True,
    ) as conn:
        exists = conn.execute("SELECT 1 FROM pg_database WHERE datname = %s", (E2E_DB,)).fetchone()
        if not exists:
            conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(E2E_DB)))


def main() -> None:
    load_env_file(Path(__file__).resolve().parent.parent / ".env.local")
    url = e2e_url(os.environ.get("TEST_DATABASE_URL", ""))
    ensure_database(url)
    # The browser talks to Vite on 5173, which proxies /api; Django must trust that origin even
    # when there is no .env.local (CI).
    os.environ.setdefault("CSRF_TRUSTED_ORIGINS", "http://localhost:5173")
    os.environ.update(
        {
            "DATABASE_URL": url,
            "E2E_MODE": "1",
            "DEBUG": "1",
            "DJANGO_SETTINGS_MODULE": "truckpilot.settings",
        }
    )
    from django.core.management import execute_from_command_line

    execute_from_command_line(["manage.py", "migrate", "--noinput"])
    execute_from_command_line(["manage.py", "runserver", f"127.0.0.1:{PORT}", "--noreload"])


if __name__ == "__main__":
    sys.exit(main())
