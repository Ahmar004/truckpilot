"""Google sign-in: check an ID token (architecture 9, tech-stack 9).

`verify` accepts the one-time credential from Google's button and returns who the person is.
Anything Google's library refuses becomes SignInFailed. The credential is never logged.
"""

import re
import time
from collections.abc import Callable
from dataclasses import dataclass

import httpx
from django.conf import settings
from google.auth import exceptions as google_exceptions
from google.auth.transport import Request
from google.oauth2 import id_token

from core.constants import GOOGLE_CERT_TIMEOUT_S, GOOGLE_CLOCK_SKEW_S
from core.errors import SignInFailed


@dataclass(frozen=True)
class GoogleIdentity:
    sub: str
    email: str
    name: str


@dataclass(frozen=True)
class _Response:
    """What google-auth reads from a response: status, headers and body bytes."""

    status: int
    headers: dict
    data: bytes


class HttpxRequest(Request):
    """A google-auth transport on httpx (already a dependency; no `requests` needed)."""

    def __call__(self, url, method="GET", body=None, headers=None, timeout=None, **kwargs):
        try:
            response = httpx.request(method, url, content=body, headers=headers, timeout=timeout)
        except httpx.HTTPError:
            raise google_exceptions.TransportError("Could not reach Google") from None
        return _Response(response.status_code, dict(response.headers), response.content)


# Google's public certificates, per process: URL -> (expires at, response), kept for
# Google's max-age. This is a cache of public data, not shared state; a cold process just
# fetches again.
_certificate_cache: dict[str, tuple[float, _Response]] = {}
_MAX_AGE = re.compile(r"max-age=(\d+)")


def _cache_control(headers) -> str:
    """The Cache-Control value, whatever the case of the header name."""
    return next((v for k, v in headers.items() if k.lower() == "cache-control"), "")


def clear_certificate_cache() -> None:
    _certificate_cache.clear()


class CachingRequest(Request):
    """A google-auth transport that caches certificate downloads and times them out."""

    def __init__(self, inner: Request | None = None, clock: Callable[[], float] = time.monotonic):
        self._inner = inner or HttpxRequest()
        self._clock = clock

    def __call__(self, url, method="GET", body=None, headers=None, timeout=None, **kwargs):
        cached = _certificate_cache.get(url)
        if cached is not None and cached[0] > self._clock():
            return cached[1]
        response = self._inner(
            url, method=method, body=body, headers=headers, timeout=GOOGLE_CERT_TIMEOUT_S, **kwargs
        )
        match = _MAX_AGE.search(_cache_control(response.headers))
        max_age = int(match.group(1)) if match else 0
        if response.status == 200 and max_age > 0:
            kept = _Response(response.status, dict(response.headers), response.data)
            _certificate_cache[url] = (self._clock() + max_age, kept)
            return kept
        return response


def verify(credential: str) -> GoogleIdentity:
    """Check Google's signature, audience, expiry and issuer, and require a verified email."""
    if not settings.GOOGLE_CLIENT_ID:
        raise SignInFailed()
    try:
        claims = id_token.verify_oauth2_token(
            credential,
            CachingRequest(),
            audience=settings.GOOGLE_CLIENT_ID,
            clock_skew_in_seconds=GOOGLE_CLOCK_SKEW_S,
        )
    except (ValueError, google_exceptions.GoogleAuthError):
        raise SignInFailed() from None
    if claims.get("email_verified") is not True:
        raise SignInFailed()
    sub, email = claims.get("sub"), claims.get("email")
    if not sub or not email:
        raise SignInFailed()
    return GoogleIdentity(sub=sub, email=email, name=claims.get("name") or email)
