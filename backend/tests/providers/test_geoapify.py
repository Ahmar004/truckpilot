import asyncio
import time
from datetime import UTC, datetime

import httpx
import pytest

from core.constants import Provider, Service
from core.errors import ProviderBudget, ProviderUnavailable
from providers import geoapify
from providers.geoapify import GeoPlace
from usage import limits
from usage.models import ProviderDay

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def geoapify_key(settings):
    settings.GEOAPIFY_API_KEY = "ga-test-key"


def reply(fixture_bytes, name):
    body = fixture_bytes(name)
    return lambda request: httpx.Response(200, content=body)


def test_chicago_answer_becomes_places_with_usa_labels(serve, fixture_bytes, fixture_json):
    serve(Provider.GEOAPIFY, reply(fixture_bytes, "geoapify_chicago.json"))
    places = geoapify.autocomplete("Chicago")
    saved = fixture_json("geoapify_chicago.json")["results"]
    assert len(places) == 5
    assert places[0] == GeoPlace(
        id=saved[0]["place_id"], label="Chicago, IL, USA", lat=saved[0]["lat"], lon=saved[0]["lon"]
    )
    assert [p.label for p in places][:3] == [
        "Chicago, IL, USA",
        "Chicago Ridge, IL, USA",
        "Chicago Lawn, Chicago, IL, USA",
    ]
    assert all(p.id and isinstance(p.lat, float) and isinstance(p.lon, float) for p in places)


def test_toronto_answer_keeps_canada_and_shortens_the_us(serve, fixture_bytes):
    serve(Provider.GEOAPIFY, reply(fixture_bytes, "geoapify_toronto.json"))
    labels = [p.label for p in geoapify.autocomplete("Toronto")]
    assert labels == [
        "Toronto, ON, Canada",
        "Toronto, IA, USA",
        "Toronto, KS, USA",
        "Old Toronto, Toronto, ON, Canada",
    ]


def test_a_place_is_a_frozen_value():
    place = GeoPlace(id="a", label="b", lat=1.0, lon=2.0)
    with pytest.raises(AttributeError):
        place.label = "c"


def test_request_parameters(serve, fixture_bytes):
    seen = serve(Provider.GEOAPIFY, reply(fixture_bytes, "geoapify_chicago.json"))
    geoapify.autocomplete("Chi")
    (request,) = seen
    assert request.method == "GET"
    params = request.url.params
    assert params["text"] == "Chi"
    assert params["filter"] == "countrycode:us,ca"
    assert params["limit"] == "5"
    assert params["lang"] == "en"
    assert params["format"] == "json"
    assert params["apiKey"] == "ga-test-key"


def test_a_result_outside_the_us_and_canada_is_dropped(serve, fixture_json):
    data = fixture_json("geoapify_chicago.json")
    data["results"][1]["country_code"] = "mx"
    data["results"][3]["country_code"] = "US"
    serve(Provider.GEOAPIFY, lambda r: httpx.Response(200, json=data))
    labels = [p.label for p in geoapify.autocomplete("Chicago")]
    assert len(labels) == 4
    assert "Chicago Ridge, IL, USA" not in labels
    assert "North Chicago, IL, USA" in labels


def test_a_result_missing_a_field_is_dropped_and_the_rest_kept(serve, fixture_json):
    data = fixture_json("geoapify_chicago.json")
    del data["results"][0]["place_id"]
    del data["results"][2]["lat"]
    serve(Provider.GEOAPIFY, lambda r: httpx.Response(200, json=data))
    assert len(geoapify.autocomplete("Chicago")) == 3


def test_no_results_is_an_empty_list(serve):
    serve(Provider.GEOAPIFY, lambda r: httpx.Response(200, json={"results": []}))
    assert geoapify.autocomplete("zzzzzz") == []


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(401, json={"message": "Invalid apiKey"}),
        httpx.Response(429),
        httpx.Response(500),
        httpx.Response(200, text="not json"),
        httpx.Response(200, json={}),
        httpx.Response(200, json={"results": "x"}),
        httpx.Response(200, json=[]),
    ],
)
def test_failures_are_unavailable_for_places(serve, response):
    serve(Provider.GEOAPIFY, lambda r: response)
    with pytest.raises(ProviderUnavailable) as caught:
        geoapify.autocomplete("Chicago")
    assert caught.value.service == Service.PLACES


@pytest.mark.parametrize("error", [httpx.ReadTimeout("slow"), httpx.ConnectError("down")])
def test_timeouts_and_connection_errors_are_unavailable(serve, error):
    def handler(request):
        raise error

    serve(Provider.GEOAPIFY, handler)
    with pytest.raises(ProviderUnavailable) as caught:
        geoapify.autocomplete("Chicago")
    assert caught.value.service == Service.PLACES


def test_the_call_is_reserved_before_the_http_request(serve, fixture_bytes, monkeypatch):
    order = []
    real_reserve = limits.reserve

    def reserve(provider, n, **kwargs):
        order.append(("reserve", provider, n))
        real_reserve(provider, n, **kwargs)

    answer = reply(fixture_bytes, "geoapify_chicago.json")

    def handler(request):
        order.append("http")
        return answer(request)

    monkeypatch.setattr(limits, "reserve", reserve)
    serve(Provider.GEOAPIFY, handler)
    geoapify.autocomplete("Chicago")
    assert order == [("reserve", Provider.GEOAPIFY, 1), "http"]


def test_a_budget_refusal_makes_no_http_request(serve, fixture_bytes):
    seen = serve(Provider.GEOAPIFY, reply(fixture_bytes, "geoapify_chicago.json"))
    ProviderDay.objects.create(
        provider=Provider.GEOAPIFY,
        day=datetime.now(UTC).date(),
        calls=Provider.GEOAPIFY.daily_budget,
    )
    with pytest.raises(ProviderBudget) as caught:
        geoapify.autocomplete("Chicago")
    assert caught.value.service == Service.PLACES
    assert seen == []


def test_a_stalled_request_ends_at_the_total_time_limit(serve, monkeypatch):
    async def handler(request):
        await asyncio.sleep(5)

    monkeypatch.setattr(geoapify, "GEOAPIFY_TIMEOUT_S", 0.05)
    serve(Provider.GEOAPIFY, handler)
    started = time.monotonic()
    with pytest.raises(ProviderUnavailable) as caught:
        geoapify.autocomplete("Chicago")
    assert caught.value.service == Service.PLACES
    assert time.monotonic() - started < 2


def test_any_error_from_the_request_is_unavailable_without_a_chain(serve):
    def handler(request):
        raise RuntimeError(f"not an httpx error: {request.url}")

    serve(Provider.GEOAPIFY, handler)
    with pytest.raises(ProviderUnavailable) as caught:
        geoapify.autocomplete("Chicago")
    assert caught.value.__cause__ is None
    assert caught.value.__context__ is None


# Reverse geocoding: "Choose on map" (Step-14b).


def test_a_land_point_becomes_its_address_with_a_short_usa(serve, fixture_bytes, fixture_json):
    serve(Provider.GEOAPIFY, reply(fixture_bytes, "geoapify_reverse_joliet.json"))
    place = geoapify.reverse(41.525, -88.0817)
    saved = fixture_json("geoapify_reverse_joliet.json")["results"][0]
    assert place == GeoPlace(
        id=saved["place_id"],
        label="1 West Jefferson Street, Joliet, IL 60432, USA",
        lat=saved["lat"],
        lon=saved["lon"],
    )


def test_reverse_request_parameters(serve, fixture_bytes):
    seen = serve(Provider.GEOAPIFY, reply(fixture_bytes, "geoapify_reverse_joliet.json"))
    geoapify.reverse(41.525, -88.0817)
    (request,) = seen
    assert request.url.path == "/v1/geocode/reverse"
    params = request.url.params
    assert (params["lat"], params["lon"]) == ("41.525", "-88.0817")
    assert params["lang"] == "en"
    assert params["format"] == "json"
    assert params["apiKey"] == "ga-test-key"


def test_a_sea_point_has_no_place(serve, fixture_bytes):
    serve(Provider.GEOAPIFY, reply(fixture_bytes, "geoapify_reverse_ocean.json"))
    assert geoapify.reverse(30.0, -60.0) is None


def test_a_point_outside_the_us_and_canada_has_no_place(serve, fixture_json):
    data = fixture_json("geoapify_reverse_joliet.json")
    data["results"][0]["country_code"] = "mx"
    serve(Provider.GEOAPIFY, lambda r: httpx.Response(200, json=data))
    assert geoapify.reverse(41.525, -88.0817) is None


def test_no_reverse_result_has_no_place(serve):
    serve(Provider.GEOAPIFY, lambda r: httpx.Response(200, json={"results": []}))
    assert geoapify.reverse(41.525, -88.0817) is None


def test_a_reverse_failure_is_unavailable_for_places(serve):
    serve(Provider.GEOAPIFY, lambda r: httpx.Response(500))
    with pytest.raises(ProviderUnavailable) as caught:
        geoapify.reverse(41.525, -88.0817)
    assert caught.value.service == Service.PLACES


def test_a_reverse_lookup_reserves_one_call_first(serve, fixture_bytes):
    seen = serve(Provider.GEOAPIFY, reply(fixture_bytes, "geoapify_reverse_joliet.json"))
    ProviderDay.objects.create(
        provider=Provider.GEOAPIFY,
        day=datetime.now(UTC).date(),
        calls=Provider.GEOAPIFY.daily_budget,
    )
    with pytest.raises(ProviderBudget):
        geoapify.reverse(41.525, -88.0817)
    assert seen == []
