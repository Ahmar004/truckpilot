"""URL routes. Vercel Services passes the full path, so Django sees /api/... (not stripped).

The Ninja API is mounted at "api/" in slice 4 (docs/architecture.md 0).
"""

urlpatterns: list = []
