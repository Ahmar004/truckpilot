from datetime import timedelta

import pytest
from django.test import Client
from django.utils import timezone

from accounts.models import Session, User
from core.constants import (
    E2E_USER_EMAIL,
    E2E_USER_NAME,
    E2E_USER_SUB,
    ErrorCode,
    Service,
    UsageKind,
)
from core.errors import SignInFailed
from providers import google
from providers.google import GoogleIdentity
from usage.models import UsageEvent

pytestmark = pytest.mark.django_db

ANN = GoogleIdentity(sub="sub-ann", email="ann@example.com", name="Ann Driver")


@pytest.fixture
def google_says(monkeypatch):
    """Make Google's check return the identity for the credential "good" and refuse the rest."""
    identities = {"good": ANN}

    def fake_verify(credential):
        if credential not in identities:
            raise SignInFailed()
        return identities[credential]

    monkeypatch.setattr(google, "verify", fake_verify)
    return identities


def browser():
    """A client that, like a browser, refuses a POST without a valid CSRF token."""
    return Client(enforce_csrf_checks=True)


def csrf_token(client):
    response = client.get("/api/csrf")
    assert response.status_code == 200
    return response.json()["csrf_token"]


def post(client, path, body=None, token=None):
    headers = {"HTTP_X_CSRFTOKEN": token} if token else {}
    return client.post(path, data=body or {}, content_type="application/json", **headers)


def sign_in(client, credential="good"):
    """Sign in the way the browser does: token first, then the credential."""
    response = post(client, "/api/auth/google", {"credential": credential}, csrf_token(client))
    assert response.status_code == 200, response.content
    return response


def code(response):
    return response.json()["code"]


def test_csrf_endpoint_returns_a_token_and_sets_the_cookie():
    client = browser()
    response = client.get("/api/csrf")
    assert response.status_code == 200
    assert len(response.json()["csrf_token"]) > 20
    assert client.cookies["csrftoken"]["httponly"]


def test_valid_credential_creates_the_user_and_an_httponly_session(google_says):
    client = browser()
    response = sign_in(client)
    assert response.json() == {"user": {"name": "Ann Driver", "email": "ann@example.com"}}
    user = User.objects.get(google_sub="sub-ann")
    assert (user.name, user.email) == ("Ann Driver", "ann@example.com")
    assert not user.has_usable_password()
    cookie = client.cookies["sessionid"]
    assert cookie["httponly"]
    assert cookie["samesite"] == "Lax"
    assert Session.objects.get(session_key=cookie.value).user_id == user.pk


def test_me_returns_the_signed_in_user(google_says):
    client = browser()
    sign_in(client)
    response = client.get("/api/me")
    assert response.status_code == 200
    assert response.json() == {"user": {"name": "Ann Driver", "email": "ann@example.com"}}


def test_signing_in_again_updates_name_and_email_without_a_second_user(google_says):
    client = browser()
    sign_in(client)
    google_says["renamed"] = GoogleIdentity(sub="sub-ann", email="new@example.com", name="Ann B")
    sign_in(browser(), "renamed")
    assert User.objects.count() == 1
    user = User.objects.get()
    assert (user.name, user.email) == ("Ann B", "new@example.com")


def test_a_refused_credential_is_sign_in_failed(google_says):
    client = browser()
    response = post(client, "/api/auth/google", {"credential": "bad"}, csrf_token(client))
    assert response.status_code == 401
    assert response.json() == {"code": ErrorCode.SIGN_IN_FAILED}
    assert not User.objects.exists()
    assert client.get("/api/me").status_code == 401


def test_me_when_signed_out_is_not_signed_in():
    response = browser().get("/api/me")
    assert response.status_code == 401
    assert response.json() == {"code": ErrorCode.NOT_SIGNED_IN}


@pytest.mark.parametrize("path", ["/api/auth/google", "/api/auth/sign-out", "/api/account/delete"])
def test_post_without_a_csrf_token_is_refused(google_says, path):
    client = browser()
    csrf_token(client)  # the cookie is there; the header is not
    response = post(client, path, {"credential": "good"})
    assert response.status_code == 403
    assert response.json() == {"code": ErrorCode.CSRF_FAILED}
    assert not User.objects.exists()


@pytest.mark.parametrize("path", ["/api/auth/sign-out", "/api/account/delete"])
def test_signed_in_post_without_a_csrf_token_changes_nothing(google_says, path):
    client = browser()
    sign_in(client)
    csrf_token(client)
    response = post(client, path)
    assert response.status_code == 403
    assert code(response) == ErrorCode.CSRF_FAILED
    assert User.objects.count() == 1
    assert client.get("/api/me").status_code == 200


@pytest.mark.parametrize("path", ["/api/auth/google", "/api/auth/sign-out", "/api/account/delete"])
def test_post_with_a_wrong_csrf_token_is_refused(google_says, path):
    client = browser()
    csrf_token(client)
    response = post(client, path, {"credential": "good"}, token="x" * 64)
    assert response.status_code == 403
    assert code(response) == ErrorCode.CSRF_FAILED


def test_the_token_from_before_sign_in_is_stale_after_it(google_says):
    client = browser()
    old = csrf_token(client)
    post(client, "/api/auth/google", {"credential": "good"}, old)
    response = post(client, "/api/auth/sign-out", token=old)
    assert response.status_code == 403
    assert post(client, "/api/auth/sign-out", token=csrf_token(client)).status_code == 204


def test_sign_out_ends_the_session(google_says):
    client = browser()
    sign_in(client)
    response = post(client, "/api/auth/sign-out", token=csrf_token(client))
    assert response.status_code == 204
    assert client.get("/api/me").status_code == 401
    assert not Session.objects.filter(user__google_sub="sub-ann").exists()


def test_sign_out_when_signed_out_is_not_signed_in():
    client = browser()
    response = post(client, "/api/auth/sign-out", token=csrf_token(client))
    assert response.status_code == 401
    assert code(response) == ErrorCode.NOT_SIGNED_IN


def test_expired_sessions_are_deleted_at_sign_in(google_says, other_user):
    past = timezone.now() - timedelta(days=1)
    future = timezone.now() + timedelta(days=1)
    Session.objects.create(session_key="expired", session_data="x", expire_date=past)
    Session.objects.create(
        session_key="alive", session_data="x", expire_date=future, user=other_user
    )
    sign_in(browser())
    keys = set(Session.objects.values_list("session_key", flat=True))
    assert "expired" not in keys
    assert "alive" in keys


def test_account_delete_removes_user_events_and_every_session(google_says, other_user):
    first, second = browser(), browser()
    sign_in(first)
    sign_in(second)
    user = User.objects.get(google_sub="sub-ann")
    UsageEvent.objects.create(user=user, kind=UsageKind.PLAN, at=timezone.now())
    UsageEvent.objects.create(user=other_user, kind=UsageKind.PLAN, at=timezone.now())
    assert Session.objects.filter(user=user).count() == 2

    response = post(first, "/api/account/delete", token=csrf_token(first))

    assert response.status_code == 204
    assert not User.objects.filter(google_sub="sub-ann").exists()
    assert not UsageEvent.objects.filter(user_id=user.pk).exists()
    assert not Session.objects.filter(user_id=user.pk).exists()
    assert UsageEvent.objects.filter(user=other_user).count() == 1
    assert User.objects.filter(pk=other_user.pk).exists()
    assert first.get("/api/me").status_code == 401
    assert second.get("/api/me").status_code == 401


def test_signing_in_after_deleting_creates_a_new_user(google_says):
    client = browser()
    sign_in(client)
    first_id = User.objects.get().pk
    post(client, "/api/account/delete", token=csrf_token(client))
    sign_in(client)
    assert User.objects.get().pk != first_id


def test_account_delete_when_signed_out_is_not_signed_in():
    client = browser()
    response = post(client, "/api/account/delete", token=csrf_token(client))
    assert response.status_code == 401
    assert code(response) == ErrorCode.NOT_SIGNED_IN


def test_api_docs_are_not_served_when_debug_is_off():
    assert browser().get("/api/docs").status_code == 404
    assert browser().get("/api/openapi.json").status_code == 404


def test_test_sign_in_is_not_mounted_without_e2e_mode():
    client = browser()
    response = post(client, "/api/test/sign-in", token=csrf_token(client))
    assert response.status_code == 404


@pytest.fixture
def e2e_urls(settings):
    settings.ROOT_URLCONF = "urls_probe"


def test_test_sign_in_signs_in_the_fixed_test_user_when_e2e_mode_is_on(e2e_urls):
    client = browser()
    response = post(client, "/api/test/sign-in", token=csrf_token(client))
    assert response.status_code == 200
    assert response.json() == {"user": {"name": E2E_USER_NAME, "email": E2E_USER_EMAIL}}
    assert User.objects.get().google_sub == E2E_USER_SUB
    assert client.get("/api/me").json()["user"]["email"] == E2E_USER_EMAIL
    # A second call reuses the same user.
    post(client, "/api/test/sign-in", token=csrf_token(client))
    assert User.objects.count() == 1


def test_test_sign_in_needs_a_csrf_token(e2e_urls):
    client = browser()
    csrf_token(client)
    response = post(client, "/api/test/sign-in")
    assert response.status_code == 403
    assert code(response) == ErrorCode.CSRF_FAILED
    assert not User.objects.exists()


def test_api_error_answers_with_its_code_status_and_extra_keys(e2e_urls):
    limited = browser().get("/api/probe/limited")
    assert limited.status_code == 429
    assert limited.json() == {"code": ErrorCode.RATE_LIMITED, "retry_after_min": 14}
    budget = browser().get("/api/probe/budget")
    assert budget.status_code == 503
    assert budget.json() == {"code": ErrorCode.PROVIDER_BUDGET, "service": Service.WEATHER}


def test_validation_error_is_invalid_input_with_a_code_per_field(e2e_urls):
    client = browser()
    response = post(client, "/api/probe/body", {"label": 5}, csrf_token(client))
    assert response.status_code == 422
    assert response.json() == {
        "code": ErrorCode.INVALID_INPUT,
        "fields": {"count": "required", "label": "invalid"},
    }


def test_missing_credential_is_invalid_input():
    client = browser()
    response = post(client, "/api/auth/google", {}, csrf_token(client))
    assert response.status_code == 422
    assert response.json() == {
        "code": ErrorCode.INVALID_INPUT,
        "fields": {"credential": "required"},
    }


def test_every_post_endpoint_refuses_a_missing_csrf_token(e2e_urls):
    """A new POST route that skips the CSRF check (Ninja views are csrf_exempt) fails here."""
    import urls_probe

    paths = [
        path
        for path, operations in urls_probe.api.get_openapi_schema()["paths"].items()
        if "post" in operations
    ]
    assert "/api/auth/google" in paths
    assert "/api/test/sign-in" in paths
    assert "/api/plans" in paths
    assert "/api/plans/update" in paths
    client = browser()
    csrf_token(client)
    for path in paths:
        response = post(client, path, {"credential": "x", "count": 1, "label": "x"})
        assert (response.status_code, response.json()) == (403, {"code": ErrorCode.CSRF_FAILED}), (
            path
        )


def test_a_body_that_is_not_json_is_invalid_input():
    client = browser()
    response = client.post(
        "/api/auth/google",
        data="{not json",
        content_type="application/json",
        HTTP_X_CSRFTOKEN=csrf_token(client),
    )
    assert response.status_code == 422
    assert response.json() == {"code": ErrorCode.INVALID_INPUT}
