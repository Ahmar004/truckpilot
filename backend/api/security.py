"""CSRF and session checks for the API.

Django Ninja marks every view csrf_exempt and only checks CSRF inside its cookie auth
class, so a POST with `auth=None` would skip it. These two guards run the check ourselves,
so every POST is covered: `csrf_guard` for public POSTs, `SignedIn` for the rest.
"""

from django.http import HttpRequest
from ninja.security import SessionAuth
from ninja.utils import check_csrf

from core.errors import CsrfFailed


def require_csrf(request: HttpRequest) -> None:
    """Raise CsrfFailed unless a safe request, or the X-CSRFToken header matches the cookie."""
    if check_csrf(request) is not None:
        raise CsrfFailed()


def csrf_guard(request: HttpRequest) -> bool:
    """Auth for a public POST (sign-in): CSRF only, which stops login CSRF."""
    require_csrf(request)
    return True


class SignedIn(SessionAuth):
    """A signed-in session, with the CSRF check done first."""

    def __init__(self) -> None:
        super().__init__(csrf=False)  # Ninja's own check is replaced by require_csrf below

    def authenticate(self, request: HttpRequest, key: str | None):
        require_csrf(request)
        return super().authenticate(request, key)
