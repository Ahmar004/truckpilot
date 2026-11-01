import json
import logging
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import httpx
import pytest
from conftest import load_fixture_bytes, openmeteo_answer
from django.utils import timezone
from helpers import Api
from test_routing import MAIN, Network, routes_of

from api import places, plans
from core.constants import (
    ErrorCode,
    Provider,
    Service,
    UsageKind,
)
from planning import plan as plan_module
from planning.bundle import read_bundle
from providers.geoapify import GeoPlace
from usage.models import ProviderDay, UsageEvent

pytestmark = pytest.mark.django_db

NOW = datetime(2026, 11, 1, 10, 0, tzinfo=UTC)  # 4:00 AM CST in Chicago
DEPARTURE = "2026-11-03T13:00"  # 1:00 PM CST = 19:00 UTC
CHICAGO = GeoPlace("place-chicago", "Chicago, IL, USA", 41.8781, -87.62978)
DALLAS = GeoPlace("place-dallas", "Dallas, TX, USA", 32.77667, -96.79699)
CENTRAL = "America/Chicago"


class Clock:
    def __init__(self):
        self.now = NOW


@pytest.fixture(autouse=True)
def clock(monkeypatch):
    """The whole backend reads one frozen clock, so the saved forecasts are always in range."""
    frozen = Clock()
    monkeypatch.setattr(timezone, "now", lambda: frozen.now)
    return frozen


@pytest.fixture(autouse=True)
def keys(settings):
    settings.TOMTOM_API_KEY = "tt-test-key"


class World:
    """The fake TomTom and Open-Meteo of a test, and what they were asked."""

    def __init__(self, serve, main_routes):
        self.serve = serve
        self.network = Network(main_routes)
        self.seen = serve(Provider.TOMTOM, self.network)
        serve(Provider.OPENMETEO, openmeteo_answer)

    def calls(self, host: str):
        return [r for r in self.seen if r.url.host == host]

    @property
    def tomtom(self):
        return self.calls("api.tomtom.com")

    @property
    def meteo(self):
        return self.calls("api.open-meteo.com")


@pytest.fixture
def world(serve):
    return World(serve, routes_of(MAIN, 3))


@pytest.fixture
def api(user):
    return Api(user)


def token(place: GeoPlace, tz: str = CENTRAL) -> str:
    return places.make_token(place, tz)


def request_body(**changes) -> dict:
    body = {
        "origin": token(CHICAGO),
        "destination": token(DALLAS),
        "departure_local": DEPARTURE,
        "load": {"value": 30_000, "unit": "lb"},
        "interval": "auto",
        "hos": True,
    }
    body.update(changes)
    return body


def plan_events(user=None) -> int:
    return UsageEvent.objects.filter(kind=UsageKind.PLAN).count()


def update_events() -> int:
    return UsageEvent.objects.filter(kind=UsageKind.UPDATE).count()


def make_plan(api, **changes):
    response = api.post("/api/plans", request_body(**changes))
    assert response.status_code == 200, response.content
    return response.json()


def update_body(plan: dict, **changes) -> dict:
    body = {"bundle": plan["bundle"], "interval": "auto", "hos": True}
    body.update(changes)
    return body


def code(response) -> str:
    return response.json()["code"]


# A plan from saved real provider answers


def test_a_plan_answers_with_three_routes_checkpoints_and_a_heatmap(api, world, user):
    plan = make_plan(api)
    assert len(plan["routes"]) == 3
    assert [r["rank"] for r in plan["routes"]] == [1, 2, 3]
    assert plan["routes"][0]["recommendation"] == "recommended"
    assert plan["trip"]["origin"] == {"label": "Chicago, IL, USA", "tz": CENTRAL}
    assert plan["trip"]["departure_utc"] == "2026-11-03T19:00:00Z"
    assert plan["now_utc"] == "2026-11-01T10:00:00Z"
    assert plan["window_end_utc"] == "2026-11-11T10:00:00Z"
    assert plan["notices"] == {
        "fewer_routes": None,
        "do_not_travel": plan["notices"]["do_not_travel"],
    }
    assert plan["interval"]["mode"] == "auto"
    assert plan["interval"]["used_mi"] == 50
    route = plan["routes"][0]
    assert route["checkpoints"][0]["n"] == 1
    assert len(route["truck"]) == 49
    heat = plan["heatmap"]
    assert len(heat["hours"]) == 49
    assert heat["hours"][0] == {"utc": "2026-11-03T19:00:00Z", "in_window": True}
    assert all(len(c["lv"]) == 49 and len(c["cz"]) == 49 for c in heat["cells"])
    assert plan_events() == 1
    assert len(world.tomtom) == 1


def test_the_bundle_in_the_answer_holds_the_plans_settings(api, world, user):
    plan = make_plan(api)
    bundle = read_bundle(plan["bundle"], user.id)
    assert bundle.inputs.load_lb == 30_000
    assert bundle.inputs.departure_utc == datetime(2026, 11, 3, 19, 0, tzinfo=UTC)
    assert bundle.now_utc == NOW
    assert len(bundle.tracks) == 3


def test_the_plan_is_built_from_the_bundles_simplified_line(api, world, user):
    plan = make_plan(api)
    bundle = read_bundle(plan["bundle"], user.id)
    from planning.geo import encode_polyline

    by_id = {f"r{t.order}": t for t in bundle.tracks}
    for route in plan["routes"]:
        assert route["line"] == encode_polyline(list(by_id[route["id"]].points))


def test_weather_numbers_are_json_numbers_at_their_own_digits(api, world):
    response = api.post("/api/plans", request_body(interval=50))
    data = json.loads(response.content, parse_float=Decimal)
    values = [
        Decimal(str(cp["weather"][key]))
        for route in data["routes"]
        for cp in route["checkpoints"]
        if cp["weather"]
        for key in ("wind_mph", "rain_in", "snow_in")
    ]
    assert values
    for value in values:
        assert value == value.quantize(Decimal("0.001")), value
    miles = data["routes"][0]["miles"]
    assert set(miles) == {"low", "moderate", "high", "severe", "no_travel", "no_data"}
    assert all(m == m.quantize(Decimal("0.01")) for m in miles.values())


# Checking the input


def test_a_bad_place_token_is_pick_place_and_nothing_is_recorded(api, world):
    response = api.post("/api/plans", request_body(origin="forged"))
    assert response.status_code == 422
    assert response.json() == {
        "code": ErrorCode.INVALID_INPUT,
        "fields": {"origin": "pick_place"},
    }
    assert plan_events() == 0
    assert world.seen == []


def test_both_bad_place_tokens_are_both_named(api, world):
    response = api.post("/api/plans", request_body(origin="x", destination=""))
    assert response.json()["fields"] == {"origin": "pick_place", "destination": "pick_place"}


def test_a_token_signed_for_another_purpose_is_not_a_place(api, world):
    from django.core import signing

    forged = signing.dumps({"id": "x"}, salt="route-bundle")
    response = api.post("/api/plans", request_body(destination=forged))
    assert response.json()["fields"] == {"destination": "pick_place"}


def test_the_same_geoapify_place_is_same_place(api, world):
    response = api.post("/api/plans", request_body(destination=token(CHICAGO)))
    assert response.status_code == 422
    assert response.json() == {"code": ErrorCode.SAME_PLACE}
    assert plan_events() == 0


def test_two_places_less_than_half_a_km_apart_are_same_place(api, world):
    near = GeoPlace("place-near", "Chicago Loop, IL, USA", 41.8781 + 0.004, -87.62978)  # 445 m
    response = api.post("/api/plans", request_body(destination=token(near)))
    assert response.json() == {"code": ErrorCode.SAME_PLACE}


def test_two_places_over_half_a_km_apart_are_planned(api, world):
    apart = GeoPlace("place-apart", "Chicago Loop, IL, USA", 41.8781 + 0.0055, -87.62978)  # 612 m
    response = api.post("/api/plans", request_body(destination=token(apart)))
    assert response.status_code == 200


@pytest.mark.parametrize(
    ("value", "unit"),
    [(80_001, "lb"), (-1, "lb"), (36_288, "kg"), (-5, "kg")],
)
def test_a_load_out_of_range_is_load_range(api, world, value, unit):
    response = api.post("/api/plans", request_body(load={"value": value, "unit": unit}))
    assert response.status_code == 422
    assert response.json() == {
        "code": ErrorCode.INVALID_INPUT,
        "fields": {"load": "load_range"},
    }
    assert plan_events() == 0


@pytest.mark.parametrize(
    "load",
    [
        {"value": 30_000.5, "unit": "lb"},
        {"value": "30000", "unit": "lb"},
        {"value": 30_000, "unit": "stone"},
        {"value": True, "unit": "lb"},
        {"unit": "lb"},
    ],
)
def test_a_load_that_is_not_a_whole_number_in_lb_or_kg_is_invalid_input(api, world, load):
    response = api.post("/api/plans", request_body(load=load))
    assert response.status_code == 422
    assert response.json()["code"] == ErrorCode.INVALID_INPUT
    assert list(response.json()["fields"]) == ["load"]
    assert plan_events() == 0


@pytest.mark.parametrize(
    ("value", "unit", "pounds"),
    [
        (0, "lb", 0),
        (80_000, "lb", 80_000),
        (13_608, "kg", 30_001),  # 30,000.50 lb rounds half up
        (13_607, "kg", 29_998),  # 29,998.3 lb
        (36_287, "kg", 79_999),
    ],
)
def test_the_load_is_turned_into_whole_pounds_and_echoed_as_typed(api, world, value, unit, pounds):
    plan = make_plan(api, load={"value": value, "unit": unit})
    assert plan["trip"]["load_lb"] == pounds
    assert plan["trip"]["load"] == {"value": value, "unit": unit}
    request = world.tomtom[0]
    expected_kg = Decimal(pounds) * Decimal("0.45359237")
    assert Decimal(request.url.params["vehicleWeight"]) == expected_kg.quantize(Decimal(1))


@pytest.mark.parametrize("interval", [5, 33, "fast", True, 25.5, None, [10]])
def test_an_interval_that_is_not_auto_10_25_or_50_is_invalid(api, world, interval):
    response = api.post("/api/plans", request_body(interval=interval))
    assert response.status_code == 422
    assert response.json()["code"] == ErrorCode.INVALID_INPUT
    assert plan_events() == 0


def test_a_bad_interval_is_named_in_fields(api, world):
    response = api.post("/api/plans", request_body(interval=33))
    assert response.json() == {"code": ErrorCode.INVALID_INPUT, "fields": {"interval": "invalid"}}


def test_hos_must_be_true_or_false(api, world):
    response = api.post("/api/plans", request_body(hos="yes"))
    assert response.status_code == 422
    assert response.json()["fields"] == {"hos": "invalid"}


@pytest.mark.parametrize("interval", ["auto", 10, 25, 50])
def test_every_allowed_interval_is_planned(api, world, interval):
    assert api.post("/api/plans", request_body(interval=interval)).status_code == 200


@pytest.mark.parametrize(
    "text",
    [
        "tomorrow",
        "2026-11-03",
        "2026-11-03T13:00Z",
        "2026-11-03T13:00+02:00",
        "2026-13-03T13:00",
        "",
    ],
)
def test_a_departure_that_is_not_a_local_wall_time_is_invalid(api, world, text):
    response = api.post("/api/plans", request_body(departure_local=text))
    assert response.status_code == 422
    assert response.json() == {
        "code": ErrorCode.INVALID_INPUT,
        "fields": {"departure_local": "invalid"},
    }


def test_a_departure_more_than_60_seconds_past_is_departure_passed(api, world):
    # Now is 04:00:00 CST; this is 61 s before.
    response = api.post("/api/plans", request_body(departure_local="2026-11-01T03:58:59"))
    assert response.status_code == 422
    assert response.json() == {"code": ErrorCode.DEPARTURE_PASSED}
    assert plan_events() == 0
    assert world.seen == []


def test_a_departure_within_60_seconds_past_is_planned_as_leaving_now(api, world):
    # 30 s before now: inside the grace, and under 60 s away, so TomTom is asked for "now".
    plan = make_plan(api, departure_local="2026-11-01T03:59:30")
    assert plan["trip"]["departure_utc"] == "2026-11-01T09:59:30Z"
    assert world.tomtom[0].url.params["departAt"] == "now"


def test_a_departure_exactly_60_seconds_past_is_still_planned(api, world):
    make_plan(api, departure_local="2026-11-01T03:59:00")


def test_a_departure_under_60_seconds_ahead_is_sent_as_now(api, world):
    make_plan(api, departure_local="2026-11-01T04:00:30")
    assert world.tomtom[0].url.params["departAt"] == "now"


def test_a_departure_60_seconds_or_more_ahead_is_sent_as_its_utc_time(api, world):
    make_plan(api)
    assert world.tomtom[0].url.params["departAt"] == "2026-11-03T19:00:00+00:00"


def test_the_departure_is_read_in_the_origins_zone(api, world):
    # The same wall time in Eastern is an hour earlier in UTC.
    origin = token(GeoPlace("place-ny", "New York, NY, USA", 40.7128, -74.006), "America/New_York")
    plan = make_plan(api, origin=origin)
    assert plan["trip"]["departure_utc"] == "2026-11-03T18:00:00Z"


def test_a_wall_time_in_a_clock_gap_or_overlap_reads_with_fold_0():
    gap = plans.departure_utc("2027-03-14T02:30", "America/Chicago")  # skipped by spring forward
    assert gap == datetime(2027, 3, 14, 8, 30, tzinfo=UTC)  # read with the winter offset
    overlap = plans.departure_utc("2026-11-01T01:30", "America/Chicago")  # happens twice
    assert overlap == datetime(2026, 11, 1, 6, 30, tzinfo=UTC)  # the first one, still CDT


def test_a_far_future_year_does_not_crash_the_check(api, world):
    response = api.post("/api/plans", request_body(departure_local="9999-12-31T23:59"))
    assert response.status_code in (200, 422)
    assert response.status_code != 500


# Limits, refunds and provider errors


def test_the_31st_plan_in_an_hour_is_rate_limited_before_any_provider_call(api, world, user):
    UsageEvent.objects.bulk_create(
        [UsageEvent(user=user, kind=UsageKind.PLAN, at=NOW) for _ in range(30)]
    )
    response = api.post("/api/plans", request_body())
    assert response.status_code == 429
    assert response.json()["code"] == ErrorCode.RATE_LIMITED
    assert response.json()["retry_after_min"] == 60
    assert world.seen == []


def test_provider_failure_refunds_plan(api, world):
    world.serve(Provider.TOMTOM, lambda request: httpx.Response(500))
    response = api.post("/api/plans", request_body())
    assert response.status_code == 502
    assert response.json() == {
        "code": ErrorCode.PROVIDER_UNAVAILABLE,
        "service": Service.ROUTING,
    }
    assert plan_events() == 0


def test_a_weather_failure_refunds_the_plan(api, world):
    world.serve(Provider.OPENMETEO, lambda request: httpx.Response(500))
    response = api.post("/api/plans", request_body())
    assert response.status_code == 502
    assert response.json() == {
        "code": ErrorCode.PROVIDER_UNAVAILABLE,
        "service": Service.WEATHER,
    }
    assert plan_events() == 0


def test_a_routing_budget_block_refunds_the_plan(api, world):
    ProviderDay.objects.create(provider=Provider.TOMTOM, day=NOW.date(), calls=650)
    response = api.post("/api/plans", request_body())
    assert response.status_code == 503
    assert response.json() == {"code": ErrorCode.PROVIDER_BUDGET, "service": Service.ROUTING}
    assert plan_events() == 0


def test_a_weather_budget_block_refunds_the_plan(api, world):
    ProviderDay.objects.create(provider=Provider.OPENMETEO, day=NOW.date(), calls=9_500)
    response = api.post("/api/plans", request_body())
    assert response.status_code == 503
    assert response.json() == {"code": ErrorCode.PROVIDER_BUDGET, "service": Service.WEATHER}
    assert plan_events() == 0


def test_no_route_keeps_the_plan_event(api, world):
    body = load_fixture_bytes("tomtom_no_route.json")
    world.serve(Provider.TOMTOM, lambda request: httpx.Response(400, content=body))
    response = api.post("/api/plans", request_body())
    assert response.status_code == 422
    assert response.json() == {"code": ErrorCode.NO_ROUTE}
    assert plan_events() == 1


def test_an_unexpected_error_does_not_charge_the_driver(user, world, monkeypatch):
    def broken(*args, **kwargs):
        raise RuntimeError("a bug")

    monkeypatch.setattr(plan_module, "build_plan", broken)
    quiet = Api(user)
    quiet.client.raise_request_exception = False
    assert quiet.post("/api/plans", request_body()).status_code == 500
    assert plan_events() == 0


def test_fewer_than_three_routes_are_reported_in_the_notices(api, world):
    no_route = load_fixture_bytes("tomtom_no_route.json")
    world.network = Network(routes_of(MAIN, 2), httpx.Response(400, content=no_route))
    world.serve(Provider.TOMTOM, world.network)
    plan = make_plan(api)
    assert len(plan["routes"]) == 2
    assert plan["notices"]["fewer_routes"] == 2


def test_plan_beyond_window_no_weather_calls(api, world):
    plan = make_plan(api, departure_local="2026-11-20T13:00")
    assert world.meteo == []
    assert plan["heatmap"] is None
    assert all(cp["weather"] is None for r in plan["routes"] for cp in r["checkpoints"])
    assert all(cp["level"] is None for r in plan["routes"] for cp in r["checkpoints"])


def test_a_signed_out_plan_is_not_signed_in(world):
    anonymous = Api()
    response = anonymous.post("/api/plans", request_body())
    assert (response.status_code, code(response)) == (401, ErrorCode.NOT_SIGNED_IN)
    assert world.seen == []


def test_a_plan_without_a_csrf_token_is_csrf_failed(api, world):
    response = api.post("/api/plans", request_body(), token=False)
    assert (response.status_code, code(response)) == (403, ErrorCode.CSRF_FAILED)
    assert plan_events() == 0


def test_a_plan_missing_a_field_is_required(api, world):
    body = request_body()
    del body["hos"]
    response = api.post("/api/plans", body)
    assert response.status_code == 422
    assert response.json() == {"code": ErrorCode.INVALID_INPUT, "fields": {"hos": "required"}}


# Updates


def numbers(plan: dict) -> dict:
    """The plan without its signed token, which differs in time and signature."""
    return {k: v for k, v in plan.items() if k != "bundle"}


def test_plan_and_update_with_the_same_settings_give_equal_numbers(api, world, clock):
    plan = make_plan(api, interval=25, hos=True)
    clock.now = NOW + timedelta(minutes=10)  # the update keeps the plan's own now
    response = api.post("/api/plans/update", update_body(plan, interval=25, hos=True))
    assert response.status_code == 200, response.content
    assert numbers(response.json()) == numbers(plan)
    assert response.json()["now_utc"] == "2026-11-01T10:00:00Z"
    assert len(world.tomtom) == 1  # the routes come from the bundle


def test_an_update_changes_only_what_the_new_settings_change(api, world):
    plan = make_plan(api, interval=25, hos=True)
    updated = api.post("/api/plans/update", update_body(plan, interval=50, hos=False)).json()
    assert updated["interval"]["used_mi"] == 50
    assert updated["interval"]["mode"] == "fixed"
    assert updated["trip"]["hos"] is False
    assert updated["trip"]["departure_utc"] == plan["trip"]["departure_utc"]
    assert updated["trip"]["load"] == plan["trip"]["load"]
    assert {r["id"] for r in updated["routes"]} == {r["id"] for r in plan["routes"]}
    first = {r["id"]: r for r in plan["routes"]}
    for route in updated["routes"]:
        assert route["distance_mi"] == first[route["id"]]["distance_mi"]
        assert route["travel_s"] < first[route["id"]]["travel_s"]  # no HOS stops


def test_an_update_gives_a_new_bundle_that_holds_the_new_settings(api, world, user):
    plan = make_plan(api, interval=25, hos=True)
    updated = api.post("/api/plans/update", update_body(plan, interval=10, hos=False)).json()
    first = read_bundle(plan["bundle"], user.id)
    second = read_bundle(updated["bundle"], user.id)
    assert (second.inputs.interval, second.inputs.hos) == (10, False)
    assert second.tracks == first.tracks
    assert second.now_utc == first.now_utc
    assert second.inputs.origin == first.inputs.origin


def test_an_update_of_an_update_gives_the_same_routes(api, world):
    plan = make_plan(api, interval=25)
    once = api.post("/api/plans/update", update_body(plan, interval=50)).json()
    twice = api.post("/api/plans/update", update_body(once, interval=25)).json()
    assert numbers(twice) == numbers(plan)


def test_a_kg_load_is_echoed_as_typed_by_an_update(api, world):
    plan = make_plan(api, load={"value": 13_608, "unit": "kg"})
    updated = api.post("/api/plans/update", update_body(plan, interval=25)).json()
    assert updated["trip"]["load"] == {"value": 13_608, "unit": "kg"}
    assert updated["trip"]["load_lb"] == 30_001


def test_fewer_routes_stays_in_the_notices_after_an_update(api, world):
    no_route = load_fixture_bytes("tomtom_no_route.json")
    world.serve(Provider.TOMTOM, Network(routes_of(MAIN, 2), httpx.Response(400, content=no_route)))
    plan = make_plan(api)
    updated = api.post("/api/plans/update", update_body(plan, interval=25)).json()
    assert updated["notices"]["fewer_routes"] == 2
    assert len(updated["routes"]) == 2


def test_each_accepted_update_records_an_update_event_and_no_plan_event(api, world):
    plan = make_plan(api)
    api.post("/api/plans/update", update_body(plan, interval=25))
    api.post("/api/plans/update", update_body(plan, interval=10))
    assert update_events() == 2
    assert plan_events() == 1


def test_the_121st_update_in_an_hour_is_rate_limited(api, world, user):
    plan = make_plan(api)
    UsageEvent.objects.bulk_create(
        [UsageEvent(user=user, kind=UsageKind.UPDATE, at=NOW) for _ in range(120)]
    )
    response = api.post("/api/plans/update", update_body(plan, interval=25))
    assert response.status_code == 429
    assert response.json()["code"] == ErrorCode.RATE_LIMITED
    assert update_events() == 120


def test_a_tampered_bundle_is_invalid_bundle_and_not_counted(api, world):
    plan = make_plan(api)
    broken = plan["bundle"][:-3] + ("aaa" if not plan["bundle"].endswith("aaa") else "bbb")
    response = api.post("/api/plans/update", update_body(plan, bundle=broken))
    assert response.status_code == 400
    assert response.json() == {"code": ErrorCode.INVALID_BUNDLE}
    assert update_events() == 0


def test_another_users_bundle_is_invalid_bundle(api, world, other_user):
    plan = make_plan(api)
    response = Api(other_user).post("/api/plans/update", update_body(plan))
    assert (response.status_code, code(response)) == (400, ErrorCode.INVALID_BUNDLE)
    assert update_events() == 0


def test_a_bundle_that_is_not_a_bundle_is_invalid_bundle(api, world):
    response = api.post("/api/plans/update", {"bundle": "nonsense", "interval": 25, "hos": True})
    assert (response.status_code, code(response)) == (400, ErrorCode.INVALID_BUNDLE)


def test_an_update_after_the_departure_is_departure_passed_and_not_counted(api, world, clock):
    plan = make_plan(api, departure_local="2026-11-01T05:00")  # 11:00 UTC
    clock.now = datetime(2026, 11, 1, 11, 1, 1, tzinfo=UTC)  # 61 s after the departure
    response = api.post("/api/plans/update", update_body(plan, interval=25))
    assert response.status_code == 422
    assert response.json() == {"code": ErrorCode.DEPARTURE_PASSED}
    assert update_events() == 0


def test_an_update_within_60_seconds_after_the_departure_is_accepted(api, world, clock):
    plan = make_plan(api, departure_local="2026-11-01T05:00")  # 11:00 UTC
    clock.now = datetime(2026, 11, 1, 11, 0, 59, tzinfo=UTC)
    response = api.post("/api/plans/update", update_body(plan, interval=25))
    assert response.status_code == 200
    assert update_events() == 1


def test_an_update_with_a_bad_interval_is_invalid_input(api, world):
    plan = make_plan(api)
    response = api.post("/api/plans/update", update_body(plan, interval=7))
    assert response.status_code == 422
    assert response.json() == {"code": ErrorCode.INVALID_INPUT, "fields": {"interval": "invalid"}}
    assert update_events() == 0


def test_a_weather_failure_on_an_update_is_refunded(api, world, clock):
    plan = make_plan(api)
    clock.now = NOW + timedelta(hours=2)  # the cached forecasts are stale now
    world.serve(Provider.OPENMETEO, lambda request: httpx.Response(500))
    response = api.post("/api/plans/update", update_body(plan, interval=25))
    assert response.status_code == 502
    assert response.json() == {
        "code": ErrorCode.PROVIDER_UNAVAILABLE,
        "service": Service.WEATHER,
    }
    assert update_events() == 0  # a provider failure is refunded, as for plans


def test_a_bundle_older_than_2_hours_is_invalid_bundle_and_not_counted(api, world, clock):
    plan = make_plan(api)
    clock.now = NOW + timedelta(hours=2, seconds=1)
    response = api.post("/api/plans/update", update_body(plan, interval=25))
    assert (response.status_code, code(response)) == (400, ErrorCode.INVALID_BUNDLE)
    assert update_events() == 0


def test_a_bundle_just_under_2_hours_old_is_accepted(api, world, clock):
    plan = make_plan(api)
    clock.now = NOW + timedelta(hours=1, minutes=59)
    response = api.post("/api/plans/update", update_body(plan, interval=25))
    assert response.status_code == 200


def test_a_signed_out_update_is_not_signed_in(world):
    response = Api().post("/api/plans/update", {"bundle": "x", "interval": 25, "hos": True})
    assert (response.status_code, code(response)) == (401, ErrorCode.NOT_SIGNED_IN)


def test_an_update_without_a_csrf_token_is_csrf_failed(api, world):
    plan = make_plan(api)
    response = api.post("/api/plans/update", update_body(plan), token=False)
    assert (response.status_code, code(response)) == (403, ErrorCode.CSRF_FAILED)
    assert update_events() == 0


# Timings


def test_timings_are_logged_without_any_trip_input(api, world, caplog):
    caplog.set_level(logging.INFO)
    plan = make_plan(api)
    api.post("/api/plans/update", update_body(plan, interval=25))
    records = [r for r in caplog.records if r.name == "api.plans"]
    assert len(records) == 2
    secrets = [
        CHICAGO.label,
        DALLAS.label,
        "Chicago",
        "Dallas",
        "41.87",
        "-87.6",
        "32.77",
        "-96.79",
        token(CHICAGO),
        plan["bundle"],
        DEPARTURE,
        "30000",
    ]
    for record in records:
        standard = vars(logging.LogRecord("n", logging.INFO, "p", 1, "m", (), None))
        extras = [str(v) for k, v in vars(record).items() if k not in standard and k != "message"]
        assert extras == []  # nothing rides along beside the message
        # The arguments are the kind of line and then only numbers (times), never text.
        assert all(isinstance(a, int | float) for a in record.args[1:])
        text = " ".join([record.getMessage(), record.args[0]])
        for secret in secrets:
            assert secret not in text, secret
        for phase in ("routing_ms", "weather_ms", "rules_ms", "total_ms"):
            assert phase in record.getMessage()
        assert record.levelno == logging.INFO
    plan_line, update_line = (r.getMessage() for r in records)
    assert plan_line.startswith("plan ")
    assert update_line.startswith("update ")
