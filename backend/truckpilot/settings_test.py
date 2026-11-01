"""Settings for tests: the real settings, but on the local Postgres (never Neon)."""

import os

from truckpilot.env import local_database_from_url
from truckpilot.settings import *  # noqa: F401,F403

DATABASES = {"default": local_database_from_url(os.environ.get("TEST_DATABASE_URL", ""))}
