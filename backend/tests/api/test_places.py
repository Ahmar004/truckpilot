import httpx
import pytest
from django.core import signing
from django.utils import timezone
from helpers import Api

from api import places
from core.constants import PLACE_SALT, ErrorCode, Provider, Service, UsageKind
from planning import zones
from usage.models import ProviderDay, UsageEvent

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def geoapify_key(settings):
    settings.GEOAPIFY_API_KEY = "ga-test-key"


@pytest.fixture
def api(user):
    return Api(user)


def answer(fixture_bytes, name):
    body = fixture_bytes(name)
    return lambda request: httpx.Response(200, content=body)


def test_a_signed_out_search_is_not_signed_in():
    response = Api().get("/api/places", q="Chicago")
    assert response.status_code == 401
    assert response.json() == {"code": ErrorCode.NOT_SIGNED_IN}


def test_places_come_with_a_label_a_zone_and_a_signed_token(api, serve, fixture_bytes):
    seen = serve(Provider.GEOAPIFY, answer(fixture_bytes, "geoapify_chicago.json"))
    response = api.get("/api/places", q="Chicago")
    assert response.status_code == 200
    found = response.json()["places"]
    assert len(found) == 5
    assert found[0]["label"] == "Chicago, IL, USA"
    assert found[0]["tz"] == "America/Chicago"
    assert set(found[0]) == {"label", "tz", "token"}
    payload = signing.loads(found[0]["token"], salt=PLACE_SALT)
    assert set(payload) == {"id", "label", "lat", "lon", "tz"}
    assert payload["tz"] == "America/Chicago"
    assert payload["label"] == "Chicago, IL, USA"
    assert len(seen) == 1


def test_a_canadian_place_gets_its_own_zone(api, serve, fixture_bytes):
    serve(Provider.GEOAPIFY, answer(fixture_bytes, "geoapify_toronto.json"))
    found = api.get("/api/places", q="Toronto").json()["places"]
    assert found[0]["label"] == "Toronto, ON, Canada"
    assert found[0]["tz"] == "America/Toronto"
    assert found[2]["tz"] == "America/Chicago"  # Toronto, KS


def test_a_place_token_reads_back_as_the_place(api, serve, fixture_bytes, fixture_json):
    serve(Provider.GEOAPIFY, answer(fixture_bytes, "geoapify_chicago.json"))
    token = api.get("/api/places", q="Chicago").json()["places"][0]["token"]
    saved = fixture_json("geoapify_chicago.json")["results"][0]
    place_id, info = places.read_token(token)
    assert place_id == saved["place_id"]
    assert (info.label, info.lat, info.lon, info.tz) == (
        "Chicago, IL, USA",
        saved["lat"],
        saved["lon"],
        "America/Chicago",
    )


def test_no_places_found_is_an_empty_list(api, serve):
    serve(Provider.GEOAPIFY, lambda request: httpx.Response(200, json={"results": []}))
    response = api.get("/api/places", q="zzzzzz")
    assert response.status_code == 200
    assert response.json() == {"places": []}


def test_a_place_with_no_zone_is_left_out(api, serve, fixture_bytes, monkeypatch):
    serve(Provider.GEOAPIFY, answer(fixture_bytes, "geoapify_chicago.json"))
    calls = iter(["America/Chicago", None, "America/Chicago", None, None])
    monkeypatch.setattr(zones, "zone_at", lambda lat, lon: next(calls))
    found = api.get("/api/places", q="Chicago").json()["places"]
    assert [p["label"] for p in found] == ["Chicago, IL, USA", "Chicago Lawn, Chicago, IL, USA"]


@pytest.mark.parametrize("q", ["", "a", " a ", "  ", "x" * 101])
def test_a_query_outside_2_to_100_characters_is_invalid_and_not_counted(api, serve, q):
    seen = serve(Provider.GEOAPIFY, lambda request: httpx.Response(200, json={"results": []}))
    response = api.get("/api/places", q=q)
    assert response.status_code == 422
    assert response.json() == {"code": ErrorCode.INVALID_INPUT, "fields": {"q": "invalid"}}
    assert seen == []
    assert not UsageEvent.objects.filter(kind=UsageKind.SEARCH).exists()


def test_a_missing_query_is_invalid_input(api):
    response = api.get("/api/places")
    assert response.status_code == 422
    assert response.json()["code"] == ErrorCode.INVALID_INPUT


def test_each_search_records_a_search_event_and_one_geoapify_call(api, serve, fixture_bytes, user):
    serve(Provider.GEOAPIFY, answer(fixture_bytes, "geoapify_chicago.json"))
    api.get("/api/places", q="Chicago")
    assert UsageEvent.objects.filter(user=user, kind=UsageKind.SEARCH).count() == 1
    assert sum(ProviderDay.objects.values_list("calls", flat=True)) == 1


def test_the_301st_search_in_an_hour_is_search_limited(api, serve, fixture_bytes, user):
    seen = serve(Provider.GEOAPIFY, answer(fixture_bytes, "geoapify_chicago.json"))
    UsageEvent.objects.bulk_create(
        [UsageEvent(user=user, kind=UsageKind.SEARCH, at=timezone.now()) for _ in range(300)]
    )
    response = api.get("/api/places", q="Chicago")
    assert response.status_code == 429
    body = response.json()
    assert body["code"] == ErrorCode.SEARCH_LIMITED
    assert 1 <= body["retry_after_min"] <= 60
    assert seen == []


def test_a_geoapify_failure_is_provider_unavailable_for_places(api, serve):
    serve(Provider.GEOAPIFY, lambda request: httpx.Response(500))
    response = api.get("/api/places", q="Chicago")
    assert response.status_code == 502
    assert response.json() == {"code": ErrorCode.PROVIDER_UNAVAILABLE, "service": Service.PLACES}


def test_the_response_never_holds_the_api_key(api, serve, fixture_bytes):
    serve(Provider.GEOAPIFY, answer(fixture_bytes, "geoapify_chicago.json"))
    assert b"ga-test-key" not in api.get("/api/places", q="Chicago").content


@pytest.mark.parametrize(
    "token",
    ["", "garbage", "a:b:c"],
)
def test_a_bad_place_token_is_refused(token):
    with pytest.raises(places.BadPlace):
        places.read_token(token)


def test_a_token_with_another_salt_or_shape_is_refused():
    good = {"id": "p", "label": "X", "lat": 41.0, "lon": -87.0, "tz": "America/Chicago"}
    assert places.read_token(signing.dumps(good, salt=PLACE_SALT))[0] == "p"
    for bad in (
        signing.dumps(good, salt="other"),
        signing.dumps([1], salt=PLACE_SALT),
        signing.dumps({**good, "tz": "Mars/Base"}, salt=PLACE_SALT),
        signing.dumps({**good, "lat": 91.0}, salt=PLACE_SALT),
        signing.dumps({**good, "lon": "far"}, salt=PLACE_SALT),
        signing.dumps({**good, "lat": True}, salt=PLACE_SALT),
        signing.dumps({k: v for k, v in good.items() if k != "id"}, salt=PLACE_SALT),
    ):
        with pytest.raises(places.BadPlace):
            places.read_token(bad)
