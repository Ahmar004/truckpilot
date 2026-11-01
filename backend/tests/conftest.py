import copy
import gzip
import inspect
import json
from pathlib import Path

import httpx
import pytest

from accounts.models import User
from core.constants import Provider
from providers import transport


@pytest.fixture
def user(db):
    return User.objects.create_user(google_sub="sub-1", email="a@example.com", name="Ann")


@pytest.fixture
def other_user(db):
    return User.objects.create_user(google_sub="sub-2", email="b@example.com", name="Bob")


# Provider test helpers: saved real answers, and a fake network (httpx.MockTransport) that the
# provider modules pick up through providers.transport.
FIXTURES_DIR = Path(__file__).parent / "fixtures"


def load_fixture_bytes(name: str) -> bytes:
    data = (FIXTURES_DIR / name).read_bytes()
    return gzip.decompress(data) if name.endswith(".gz") else data


def load_fixture(name: str):
    return json.loads(load_fixture_bytes(name))


@pytest.fixture
def fixture_json():
    return load_fixture


@pytest.fixture
def fixture_bytes():
    return load_fixture_bytes


@pytest.fixture
def serve(monkeypatch):
    """serve(provider, handler) answers that provider's calls with handler(request).

    The handler is a plain function (works for sync and async clients) or an async one.
    Returns the list of requests seen.
    """
    handlers: dict[Provider, object] = {}
    seen: list[httpx.Request] = []

    def transport_for(provider):
        handler = handlers.get(provider)
        if handler is None:
            raise AssertionError(f"unexpected call to {provider}")

        if inspect.iscoroutinefunction(handler):

            async def record_async(request):
                seen.append(request)
                return await handler(request)

            return httpx.MockTransport(record_async)

        def record(request):
            seen.append(request)
            return handler(request)

        return httpx.MockTransport(record)

    monkeypatch.setattr(transport, "transport_for", transport_for)

    def install(provider, handler):
        handlers[provider] = handler
        return seen

    return install


def openmeteo_answer(request: httpx.Request, name: str = "openmeteo_3_locations.json"):
    """A real saved Open-Meteo answer shaped for the request: one series per location asked.

    The saved series are reused in turn; one location gets an object, several get a list.
    """
    saved = load_fixture(name)
    count = len(request.url.params["latitude"].split(","))
    series = [copy.deepcopy(saved[i % len(saved)]) for i in range(count)]
    return httpx.Response(200, json=series[0] if count == 1 else series)
