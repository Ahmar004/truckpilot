"""A provider key sits in the request URL, so it must never reach an error or a log."""

import logging
import traceback
from datetime import UTC, datetime

import httpx
import pytest

from core.constants import Provider
from core.errors import ProviderUnavailable
from providers import geoapify, tomtom

pytestmark = pytest.mark.django_db

KEY = "SECRET-KEY-do-not-leak-0123456789"
CHICAGO = (41.8781, -87.62978)
DALLAS = (32.77667, -96.79699)
DEPART = datetime(2026, 11, 3, 14, 30, tzinfo=UTC)


@pytest.fixture(autouse=True)
def keys(settings):
    settings.TOMTOM_API_KEY = KEY
    settings.GEOAPIFY_API_KEY = KEY


def call_tomtom():
    tomtom.routes(CHICAGO, DALLAS, 30_000, DEPART)


def call_geoapify():
    geoapify.autocomplete("Chicago")


def failing(kind, url_had_key):
    def handler(request):
        # The URL really does hold the key; that is what must not leak. (An assertion here
        # would be swallowed as a failed call, so the result is recorded and checked below.)
        url_had_key.append(KEY in str(request.url))
        if kind == "connect":
            raise httpx.ConnectError("could not connect", request=request)
        if kind == "timeout":
            raise httpx.ReadTimeout("slow", request=request)
        return httpx.Response(500, text=f"upstream broke for {request.url}")

    return handler


# What the warning must name: the error's type, or the HTTP status when there was no error.
LOGGED = {"connect": "error=ConnectError", "timeout": "error=ReadTimeout", "500": "status=500"}


@pytest.mark.parametrize("kind", ["connect", "timeout", "500"])
@pytest.mark.parametrize(
    "provider,call", [(Provider.TOMTOM, call_tomtom), (Provider.GEOAPIFY, call_geoapify)]
)
def test_key_never_in_error_or_log(serve, caplog, provider, call, kind):
    url_had_key = []
    serve(provider, failing(kind, url_had_key))
    caplog.set_level(logging.DEBUG)
    with pytest.raises(ProviderUnavailable) as caught:
        call()
    error = caught.value
    assert url_had_key == [True]
    # Nothing is chained: the httpx error that holds the URL is not reachable from ours.
    # (The modules raise outside their except blocks, so there is no context to suppress.)
    assert error.__cause__ is None
    assert error.__context__ is None
    assert KEY not in str(error)
    assert KEY not in repr(error)
    assert KEY not in repr(error.args)
    assert KEY not in "".join(traceback.format_exception(error))
    assert KEY not in caplog.text
    for record in caplog.records:
        assert KEY not in record.getMessage()
        assert KEY not in repr(record.args)
    # The failure is not silent: one warning with the service and the error type or status.
    warnings = [r for r in caplog.records if r.levelno == logging.WARNING]
    assert len(warnings) == 1
    message = warnings[0].getMessage()
    assert LOGGED[kind] in message
    assert str(provider.service) in message
    assert warnings[0].exc_info is None


@pytest.mark.parametrize("name", ["httpx", "httpcore"])
def test_http_library_loggers_do_not_log_requests(name):
    # httpx logs every request URL at INFO; the setting keeps it from doing so.
    assert logging.getLogger(name).getEffectiveLevel() >= logging.WARNING
