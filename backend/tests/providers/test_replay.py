"""With E2E_MODE each provider answers from saved real answers, without a network call."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal

import httpx
import pytest

from core.constants import Provider, RouteSource
from providers import geoapify, openmeteo, replay, tomtom, transport
from weather.forecast import Forecast

pytestmark = pytest.mark.django_db

CHICAGO = (41.8781, -87.62978)
DALLAS = (32.77667, -96.79699)
KANSAS = (37.90002, -94.89666)
DEPART = datetime(2026, 11, 3, 14, 30, tzinfo=UTC)


@pytest.fixture(autouse=True)
def e2e_without_network(settings, monkeypatch):
    settings.E2E_MODE = True

    def refuse(self, request):
        raise AssertionError("a real network call was attempted")

    monkeypatch.setattr(httpx.HTTPTransport, "handle_request", refuse)
    monkeypatch.setattr(httpx.AsyncHTTPTransport, "handle_async_request", refuse)


def test_outside_e2e_mode_the_real_network_is_used(settings):
    settings.E2E_MODE = False
    assert transport.transport_for(Provider.TOMTOM) is None


def test_tomtom_main_call_answers_the_chicago_dallas_routes():
    tracks = tomtom.routes(CHICAGO, DALLAS, 30_000, DEPART)
    assert len(tracks) == 3
    assert {t.source for t in tracks} == {RouteSource.API}


def test_tomtom_is_trimmed_to_the_alternatives_asked_for():
    assert len(tomtom.routes(CHICAGO, DALLAS, 30_000, DEPART, max_alternatives=0)) == 1
    assert len(tomtom.routes(CHICAGO, DALLAS, 30_000, DEPART, max_alternatives=1)) == 2


def test_tomtom_call_with_a_waypoint_answers_the_waypoint_routes():
    tracks = tomtom.routes(CHICAGO, DALLAS, 30_000, DEPART, waypoint=KANSAS)
    assert len(tracks) == 3
    assert {t.source for t in tracks} == {RouteSource.DETOUR}
    # The saved Waypoint answer goes through Kansas, so it is longer than the direct route.
    direct = tomtom.routes(CHICAGO, DALLAS, 30_000, DEPART, max_alternatives=0)[0]
    assert tracks[0].length_mi > direct.length_mi


@pytest.mark.parametrize(
    "text,label,count",
    [
        ("Chicago", "Chicago, IL, USA", 5),
        ("chic", "Chicago, IL, USA", 5),
        ("Toronto", "Toronto, ON, Canada", 4),
        ("Toro", "Toronto, ON, Canada", 4),
    ],
)
def test_geoapify_answers_the_saved_answer_that_matches_best(text, label, count):
    places = geoapify.autocomplete(text)
    assert places[0].label == label
    assert len(places) == count


def test_geoapify_reverse_answers_the_saved_map_pick():
    assert geoapify.reverse(41.525, -88.0817).label.endswith("Joliet, IL 60432, USA")


def this_hour() -> datetime:
    return datetime.now(UTC).replace(minute=0, second=0, microsecond=0)


def test_openmeteo_answers_real_series_starting_at_the_current_utc_hour(fixture_json):
    saved = fixture_json("openmeteo_3_locations.json")
    now = datetime.now(UTC)
    # Dallas: the nearest saved location is the third one, 32.81, -96.80.
    (dallas,) = openmeteo.fetch([(32.8, -96.8)], now)
    assert isinstance(dallas, Forecast)
    assert dallas.start_utc in {this_hour(), this_hour() - timedelta(hours=1)}
    assert dallas.wind_mph[0] == Decimal(str(saved[2]["hourly"]["wind_speed_10m"][0]))
    assert len(dallas.wind_mph) == 264


def test_the_replayed_series_covers_the_window_late_in_the_day(monkeypatch):
    late = datetime(2026, 11, 3, 23, 30, tzinfo=UTC)
    monkeypatch.setattr(replay, "_now", lambda: late)
    (forecast,) = openmeteo.fetch([(41.9, -87.6)], late)
    assert forecast.start_utc == datetime(2026, 11, 3, 23, 0, tzinfo=UTC)
    # The last hour of the window is now + 240 h rounded up to the next hour (7.5, 7.6).
    last_hour = datetime(2026, 11, 14, 0, 0, tzinfo=UTC)
    assert last_hour >= late + timedelta(hours=240)
    assert forecast.at(last_hour) is not None
    assert forecast.at(last_hour + timedelta(hours=1)) is not None


def test_openmeteo_picks_the_nearest_saved_location_for_each_point(fixture_json):
    saved = fixture_json("openmeteo_3_locations.json")
    chicago, tulsa = openmeteo.fetch([(41.9, -87.6), (36.2, -95.9)], datetime.now(UTC))
    assert chicago.wind_mph[:24] == tuple(
        Decimal(str(v)) for v in saved[0]["hourly"]["wind_speed_10m"][:24]
    )
    assert tulsa.wind_mph[:24] == tuple(
        Decimal(str(v)) for v in saved[1]["hourly"]["wind_speed_10m"][:24]
    )


def test_openmeteo_snow_comes_from_the_saved_snow_locations(fixture_json):
    saved = fixture_json("openmeteo_snow_3_locations.json")[2]["hourly"]
    # Near the saved location 63.80, -68.51 (Baffin Island), which has real snowfall.
    (north,) = openmeteo.fetch([(63.8, -68.5)], datetime.now(UTC))
    assert any(v > 0 for v in north.snow_in)
    assert north.snow_in[:48] == tuple(Decimal(str(v)) for v in saved["snowfall"][:48])


def test_openmeteo_handles_many_points():
    points = [(30 + i / 100, -90.0) for i in range(250)]
    assert len(openmeteo.fetch(points, datetime.now(UTC))) == 250


def test_the_series_shift_keeps_its_hours_consecutive():
    (forecast,) = openmeteo.fetch([(41.9, -87.6)], datetime.now(UTC))
    assert forecast.at(forecast.start_utc + timedelta(hours=30)) is not None
