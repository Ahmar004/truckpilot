"""URL routes. Vercel Services passes the full path, so Django sees /api/... (not stripped)."""

from django.conf import settings
from django.urls import path

from api import build_api

api = build_api(debug=settings.DEBUG, e2e=settings.E2E_MODE)

urlpatterns = [path("api/", api.urls)]
