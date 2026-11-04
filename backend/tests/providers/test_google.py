import pytest
from google.auth import exceptions as google_exceptions
from google.oauth2 import id_token

from core.constants import ErrorCode
from core.errors import SignInFailed
from providers import google
from providers.google import GoogleIdentity

CERTS_URL = "https://www.googleapis.com/oauth2/v1/certs"
CLAIMS = {
    "iss": "https://accounts.google.com",
    "sub": "1234567890",
    "email": "ann@example.com",
    "email_verified": True,
    "name": "Ann Driver",
}


@pytest.fixture(autouse=True)
def client_id(settings):
    settings.GOOGLE_CLIENT_ID = "client-id.apps.googleusercontent.com"
    google.clear_certificate_cache()


@pytest.fixture
def fake_verify(monkeypatch):
    """Replace Google's check; returns the list of calls it received."""
    calls = []

    def fake(credential, request, audience=None, **kwargs):
        calls.append({"credential": credential, "audience": audience, **kwargs})
        return dict(CLAIMS)

    monkeypatch.setattr(id_token, "verify_oauth2_token", fake)
    return calls


def test_verified_credential_gives_an_identity_and_checks_the_audience(fake_verify):
    identity = google.verify("the-credential")
    assert identity == GoogleIdentity(sub="1234567890", email="ann@example.com", name="Ann Driver")
    assert fake_verify == [
        {
            "credential": "the-credential",
            "audience": "client-id.apps.googleusercontent.com",
            "clock_skew_in_seconds": 10,
        }
    ]


def test_identity_is_frozen(fake_verify):
    identity = google.verify("c")
    with pytest.raises(AttributeError):
        identity.email = "other@example.com"


def test_a_missing_name_falls_back_to_the_email(monkeypatch):
    claims = {k: v for k, v in CLAIMS.items() if k != "name"}
    monkeypatch.setattr(id_token, "verify_oauth2_token", lambda *a, **k: claims)
    assert google.verify("c").name == "ann@example.com"


@pytest.mark.parametrize("verified", [False, None, "true"])
def test_an_unverified_email_is_refused(monkeypatch, verified):
    claims = {**CLAIMS, "email_verified": verified}
    monkeypatch.setattr(id_token, "verify_oauth2_token", lambda *a, **k: claims)
    with pytest.raises(SignInFailed) as caught:
        google.verify("c")
    assert caught.value.code == ErrorCode.SIGN_IN_FAILED
    assert caught.value.status == 401


def test_a_missing_email_is_refused(monkeypatch):
    claims = {k: v for k, v in CLAIMS.items() if k != "email"}
    monkeypatch.setattr(id_token, "verify_oauth2_token", lambda *a, **k: claims)
    with pytest.raises(SignInFailed):
        google.verify("c")


@pytest.mark.parametrize(
    "error",
    [
        ValueError("Token has wrong audience"),
        google_exceptions.GoogleAuthError("Wrong issuer"),
        google_exceptions.TransportError("certs unreachable"),
    ],
)
def test_a_refused_token_is_sign_in_failed(monkeypatch, error):
    def refuse(*args, **kwargs):
        raise error

    monkeypatch.setattr(id_token, "verify_oauth2_token", refuse)
    with pytest.raises(SignInFailed):
        google.verify("c")


def test_without_a_client_id_every_credential_is_refused(settings, fake_verify):
    settings.GOOGLE_CLIENT_ID = ""
    with pytest.raises(SignInFailed):
        google.verify("c")
    assert fake_verify == []


class FakeResponse:
    def __init__(self, headers=None, status=200, data=b'{"kid": "cert"}'):
        self.status = status
        self.headers = (
            {"Cache-Control": "public, max-age=100, must-revalidate"}
            if headers is None
            else headers
        )
        self.data = data


class FakeTransport:
    def __init__(self, response=None):
        self.response = response or FakeResponse()
        self.calls = []

    def __call__(self, url, method="GET", body=None, headers=None, timeout=None, **kwargs):
        self.calls.append({"url": url, "method": method, "timeout": timeout})
        return self.response


class Clock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


def test_certificates_are_fetched_once_until_max_age_passes():
    inner, clock = FakeTransport(), Clock()
    request = google.CachingRequest(inner, clock=clock)
    first = request(CERTS_URL, method="GET")
    clock.now += 99
    second = request(CERTS_URL, method="GET")
    assert len(inner.calls) == 1
    assert second.data == first.data == b'{"kid": "cert"}'
    assert second.status == 200
    clock.now += 2
    request(CERTS_URL, method="GET")
    assert len(inner.calls) == 2


def test_the_certificate_fetch_has_a_5_second_timeout():
    inner = FakeTransport()
    google.CachingRequest(inner, clock=Clock())(CERTS_URL, method="GET", timeout=120)
    assert inner.calls[0]["timeout"] == 5


def test_the_cache_is_shared_between_requests_in_one_process():
    inner, clock = FakeTransport(), Clock()
    google.CachingRequest(inner, clock=clock)(CERTS_URL, method="GET")
    google.CachingRequest(inner, clock=clock)(CERTS_URL, method="GET")
    assert len(inner.calls) == 1


@pytest.mark.parametrize(
    "response",
    [
        FakeResponse(status=500),
        FakeResponse(headers={}),
        FakeResponse(headers={"Cache-Control": "no-store"}),
        FakeResponse(headers={"Cache-Control": "max-age=0"}),
    ],
)
def test_an_error_or_a_response_without_max_age_is_not_cached(response):
    inner = FakeTransport(response)
    request = google.CachingRequest(inner, clock=Clock())
    request(CERTS_URL, method="GET")
    request(CERTS_URL, method="GET")
    assert len(inner.calls) == 2


def test_the_default_transport_maps_a_network_failure_to_a_transport_error(monkeypatch):
    import httpx

    def fail(*args, **kwargs):
        raise httpx.ConnectTimeout("slow")

    monkeypatch.setattr(httpx, "request", fail)
    with pytest.raises(google_exceptions.TransportError):
        google.HttpxRequest()(CERTS_URL, method="GET", timeout=5)


def test_the_default_transport_returns_status_headers_and_body(monkeypatch):
    import httpx

    reply = httpx.Response(200, content=b"{}", headers={"Cache-Control": "max-age=5"})
    monkeypatch.setattr(httpx, "request", lambda *args, **kwargs: reply)
    response = google.HttpxRequest()(CERTS_URL, method="GET", timeout=5)
    assert (response.status, response.data) == (200, b"{}")
    assert response.headers["cache-control"] == "max-age=5"


def test_max_age_is_found_whatever_the_case_of_the_header_name():
    inner = FakeTransport(FakeResponse(headers={"cache-control": "public, max-age=100"}))
    request = google.CachingRequest(inner, clock=Clock())
    request(CERTS_URL, method="GET")
    request(CERTS_URL, method="GET")
    assert len(inner.calls) == 1
