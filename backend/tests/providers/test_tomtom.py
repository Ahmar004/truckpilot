import asyncio
import copy
import functools
import time
from datetime import UTC, datetime, timedelta, timezone

import httpx
import pytest
from conftest import load_fixture

from core.constants import (
    TOMTOM_RETRY_WAIT_MAX_S,
    TOMTOM_RETRY_WAIT_MIN_S,
    ErrorCode,
    Provider,
    RouteSource,
    Service,
)
from core.errors import NoRoute, ProviderBudget, ProviderUnavailable
from providers import tomtom
from usage import limits
from usage.models import ProviderDay

pytestmark = pytest.mark.django_db

CHICAGO = (41.8781, -87.62978)
DALLAS = (32.77667, -96.79699)
KANSAS = (37.90002, -94.89666)
DEPART = datetime(2026, 11, 3, 14, 30, tzinfo=UTC)


@functools.cache
def _saved(name: str) -> dict:
    return load_fixture(name)


def saved(name: str) -> dict:
    return copy.deepcopy(_saved(name))


MAIN = "tomtom_chicago_dallas_truck_alt5.json.gz"
WAYPOINT = "tomtom_chicago_dallas_waypoint_alt5.json.gz"


def answer_with(name: str, mutate=None):
    """A handler answering the saved route answer, trimmed like TomTom does to maxAlternatives."""

    def handler(request):
        keep = 1 + int(request.url.params["maxAlternatives"])
        data = {"routes": copy.deepcopy(_saved(name)["routes"][:keep])}
        if mutate:
            mutate(data)
        return httpx.Response(200, json=data)

    return handler


@pytest.fixture(autouse=True)
def tomtom_key(settings):
    settings.TOMTOM_API_KEY = "tt-test-key"


@pytest.fixture
def no_wait(monkeypatch):
    waits = []

    async def pause():
        waits.append(1)

    monkeypatch.setattr(tomtom, "_pause", pause)
    return waits


def calls_today() -> int:
    return sum(ProviderDay.objects.filter(provider=Provider.TOMTOM).values_list("calls", flat=True))


def test_main_answer_becomes_route_tracks_that_match_the_summaries(serve):
    serve(Provider.TOMTOM, answer_with(MAIN))
    tracks = tomtom.routes(CHICAGO, DALLAS, 30_000, DEPART)
    raw = saved(MAIN)["routes"][:3]
    assert len(tracks) == 3
    for order, (track, route) in enumerate(zip(tracks, raw, strict=True)):
        assert track.source == RouteSource.API
        assert track.order == order
        assert track.dist_m[-1] == route["summary"]["lengthInMeters"]
        assert track.driving_s == pytest.approx(route["summary"]["travelTimeInSeconds"], abs=1)
        # TomTom's raw points are kept, never simplified.
        assert len(track.points) == sum(len(leg["points"]) for leg in route["legs"])
        assert track.points[0] == (CHICAGO[0], CHICAGO[1])
        assert track.points[-1] == (DALLAS[0], DALLAS[1])


def test_points_between_anchors_are_filled_in_by_their_share_of_distance(serve):
    serve(Provider.TOMTOM, answer_with(MAIN))
    track = tomtom.routes(CHICAGO, DALLAS, 30_000, DEPART)[0]
    route = saved(MAIN)["routes"][0]
    for anchor in route["progress"]:
        i = anchor["pointIndex"]
        assert track.dist_m[i] == anchor["distanceInMeters"]
        assert track.drive_s[i] == anchor["travelTimeInSeconds"]
    a, b = next(
        (a, b)
        for a, b in zip(route["progress"], route["progress"][1:], strict=False)
        if b["pointIndex"] - a["pointIndex"] > 50
    )
    middle = range(a["pointIndex"] + 1, b["pointIndex"])
    for i in middle:
        assert a["distanceInMeters"] <= track.dist_m[i] <= b["distanceInMeters"]
        assert a["travelTimeInSeconds"] <= track.drive_s[i] <= b["travelTimeInSeconds"]


def test_waypoint_answer_has_two_legs_joined_as_is_and_is_a_detour(serve):
    seen = serve(Provider.TOMTOM, answer_with(WAYPOINT))
    tracks = tomtom.routes(CHICAGO, DALLAS, 30_000, DEPART, waypoint=KANSAS)
    raw = saved(WAYPOINT)["routes"][:3]
    assert len(raw[0]["legs"]) == 2
    for order, (track, route) in enumerate(zip(tracks, raw, strict=True)):
        assert track.source == RouteSource.DETOUR
        assert track.order == order
        # TomTom's pointIndex counts the legs joined as they are, so the point where the
        # legs meet appears twice and is kept twice.
        assert len(track.points) == sum(len(leg["points"]) for leg in route["legs"])
        assert track.dist_m[-1] == route["summary"]["lengthInMeters"]
        assert track.driving_s == pytest.approx(route["summary"]["travelTimeInSeconds"], abs=1)
    join = len(raw[0]["legs"][0]["points"])
    assert tracks[0].points[join - 1] == tracks[0].points[join] == KANSAS
    (request,) = seen
    assert "41.8781,-87.62978:37.90002,-94.89666:32.77667,-96.79699" in request.url.path


def test_request_parameters(serve):
    seen = serve(Provider.TOMTOM, answer_with(MAIN))
    tomtom.routes(CHICAGO, DALLAS, 30_000, DEPART, max_alternatives=2)
    (request,) = seen
    assert request.method == "GET"
    assert request.url.path.endswith("/calculateRoute/41.8781,-87.62978:32.77667,-96.79699/json")
    params = request.url.params
    assert params["key"] == "tt-test-key"
    assert params["travelMode"] == "truck"
    assert params["vehicleWeight"] == "13608"
    assert params["maxAlternatives"] == "2"
    assert params["routeType"] == "fastest"
    assert params["traffic"] == "true"
    assert params["departAt"] == "2026-11-03T14:30:00+00:00"
    assert params["routeRepresentation"] == "polyline"
    assert params.get_list("extendedRouteRepresentation") == ["distance", "travelTime"]


def test_depart_at_is_sent_in_utc_whatever_the_zone_it_came_in(serve):
    seen = serve(Provider.TOMTOM, answer_with(MAIN))
    central = timezone(timedelta(hours=-6))
    tomtom.routes(CHICAGO, DALLAS, 30_000, datetime(2026, 11, 3, 8, 30, tzinfo=central))
    assert seen[0].url.params["departAt"] == "2026-11-03T14:30:00+00:00"


def test_no_departure_asks_for_now(serve):
    seen = serve(Provider.TOMTOM, answer_with(MAIN))
    tomtom.routes(CHICAGO, DALLAS, 30_000, None)
    assert seen[0].url.params["departAt"] == "now"


def test_a_departure_without_a_time_zone_is_refused(serve):
    serve(Provider.TOMTOM, answer_with(MAIN))
    with pytest.raises(ValueError):
        tomtom.routes(CHICAGO, DALLAS, 30_000, datetime(2026, 11, 3, 14, 30))


@pytest.mark.parametrize(
    "load_lb,kg", [(30_000, "13608"), (0, "0"), (1, "0"), (2, "1"), (80_000, "36287")]
)
def test_the_load_is_sent_in_whole_kilograms_rounded_half_up(serve, load_lb, kg):
    seen = serve(Provider.TOMTOM, answer_with(MAIN))
    tomtom.routes(CHICAGO, DALLAS, load_lb, DEPART)
    assert seen[0].url.params["vehicleWeight"] == kg


def test_max_alternatives_defaults_to_the_main_call_value(serve):
    seen = serve(Provider.TOMTOM, answer_with(MAIN))
    tracks = tomtom.routes(CHICAGO, DALLAS, 30_000, DEPART)
    assert seen[0].url.params["maxAlternatives"] == "2"
    assert len(tracks) == 3


def test_no_route_found_is_no_route(serve, fixture_bytes):
    body = fixture_bytes("tomtom_no_route.json")
    serve(Provider.TOMTOM, lambda r: httpx.Response(400, content=body))
    with pytest.raises(NoRoute) as caught:
        tomtom.routes(CHICAGO, DALLAS, 30_000, DEPART)
    assert caught.value.code == ErrorCode.NO_ROUTE


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(400, json={"detailedError": {"code": "MAP_MATCHING_FAILURE"}}),
        httpx.Response(400, text="not json"),
        httpx.Response(400, json={}),
        httpx.Response(403, text="forbidden"),
        httpx.Response(404),
        httpx.Response(500),
        httpx.Response(503),
        httpx.Response(200, text="not json"),
        httpx.Response(200, json={"routes": []}),
        httpx.Response(200, json={"routes": [{"legs": [], "progress": []}]}),
        httpx.Response(200, json={"other": 1}),
    ],
)
def test_other_failures_are_unavailable(serve, response):
    serve(Provider.TOMTOM, lambda r: response)
    with pytest.raises(ProviderUnavailable) as caught:
        tomtom.routes(CHICAGO, DALLAS, 30_000, DEPART)
    assert caught.value.service == Service.ROUTING


@pytest.mark.parametrize("error", [httpx.ReadTimeout("slow"), httpx.ConnectError("down")])
def test_timeouts_and_connection_errors_are_unavailable(serve, error):
    def handler(request):
        raise error

    serve(Provider.TOMTOM, handler)
    with pytest.raises(ProviderUnavailable) as caught:
        tomtom.routes(CHICAGO, DALLAS, 30_000, DEPART)
    assert caught.value.service == Service.ROUTING


def first_route_only(mutate):
    def edit(data):
        data["routes"] = data["routes"][:1]
        mutate(data["routes"][0])

    return edit


@pytest.mark.parametrize(
    "break_it",
    [
        # pointIndex stops rising.
        lambda r: r["progress"][2].update(pointIndex=r["progress"][1]["pointIndex"]),
        lambda r: r["progress"][2].update(pointIndex=r["progress"][1]["pointIndex"] - 1),
        # Distance or time goes down.
        lambda r: r["progress"][5].update(distanceInMeters=0),
        lambda r: r["progress"][5].update(travelTimeInSeconds=0),
        # Does not start at index 0, or does not reach the last point.
        lambda r: r["progress"].pop(0),
        lambda r: r["progress"].pop(),
        lambda r: r["progress"][0].update(distanceInMeters=5),
        # Points are missing, so the last index points past the end.
        lambda r: r["legs"][0]["points"].pop(),
        # Fewer than 2 points.
        lambda r: (r["legs"][0].update(points=r["legs"][0]["points"][:1]), r["progress"].clear()),
    ],
)
def test_tomtom_bad_progress(serve, break_it):
    serve(Provider.TOMTOM, answer_with(MAIN, first_route_only(break_it)))
    with pytest.raises(ProviderUnavailable) as caught:
        tomtom.routes(CHICAGO, DALLAS, 30_000, DEPART)
    assert caught.value.service == Service.ROUTING


def test_a_429_waits_then_retries_once_and_succeeds(serve, no_wait):
    answers = [httpx.Response(429), None]

    def handler(request):
        reply = answers.pop(0)
        return reply or answer_with(MAIN)(request)

    seen = serve(Provider.TOMTOM, handler)
    assert len(tomtom.routes(CHICAGO, DALLAS, 30_000, DEPART)) == 3
    assert len(seen) == 2
    assert len(no_wait) == 1
    # One logical call is one reservation; the retry is not reserved again.
    assert calls_today() == 1


def test_two_429s_in_a_row_are_unavailable(serve, no_wait):
    seen = serve(Provider.TOMTOM, lambda r: httpx.Response(429))
    with pytest.raises(ProviderUnavailable) as caught:
        tomtom.routes(CHICAGO, DALLAS, 30_000, DEPART)
    assert caught.value.service == Service.ROUTING
    assert len(seen) == 2
    assert len(no_wait) == 1


def test_the_retry_wait_is_a_random_time_in_the_documented_range(monkeypatch):
    waits = []

    async def fake_sleep(seconds):
        waits.append(seconds)

    monkeypatch.setattr(tomtom.asyncio, "sleep", fake_sleep)
    for _ in range(50):
        asyncio.run(tomtom._pause())
    assert all(TOMTOM_RETRY_WAIT_MIN_S <= w <= TOMTOM_RETRY_WAIT_MAX_S for w in waits)
    assert len(set(waits)) > 1


def test_the_call_is_reserved_before_the_http_request(serve, monkeypatch):
    order = []
    real_reserve = limits.reserve

    def reserve(provider, n, **kwargs):
        order.append(("reserve", provider, n))
        real_reserve(provider, n, **kwargs)

    def handler(request):
        order.append("http")
        return answer_with(MAIN)(request)

    monkeypatch.setattr(limits, "reserve", reserve)
    serve(Provider.TOMTOM, handler)
    tomtom.routes(CHICAGO, DALLAS, 30_000, DEPART)
    assert order == [("reserve", Provider.TOMTOM, 1), "http"]
    assert calls_today() == 1


def test_a_budget_refusal_makes_no_http_request(serve):
    seen = serve(Provider.TOMTOM, answer_with(MAIN))
    today = datetime.now(UTC).date()
    ProviderDay.objects.create(provider=Provider.TOMTOM, day=today, calls=650)
    with pytest.raises(ProviderBudget) as caught:
        tomtom.routes(CHICAGO, DALLAS, 30_000, DEPART)
    assert caught.value.service == Service.ROUTING
    assert seen == []


def test_the_async_call_can_run_several_at_once_and_reserves_nothing(serve):
    seen = serve(Provider.TOMTOM, answer_with(WAYPOINT))

    async def four():
        return await asyncio.gather(
            *(
                tomtom.routes_async(CHICAGO, DALLAS, 30_000, DEPART, waypoint=KANSAS)
                for _ in range(4)
            )
        )

    results = asyncio.run(four())
    assert [len(r) for r in results] == [3, 3, 3, 3]
    assert len(seen) == 4
    assert calls_today() == 0


def test_a_stalled_attempt_ends_at_the_total_time_limit(serve, monkeypatch):
    async def handler(request):
        await asyncio.sleep(5)

    monkeypatch.setattr(tomtom, "TOMTOM_TIMEOUT_S", 0.05)
    serve(Provider.TOMTOM, handler)
    started = time.monotonic()
    with pytest.raises(ProviderUnavailable) as caught:
        tomtom.routes(CHICAGO, DALLAS, 30_000, DEPART)
    assert caught.value.service == Service.ROUTING
    assert time.monotonic() - started < 2


def test_the_retry_after_a_429_has_its_own_time_limit(serve, monkeypatch, no_wait):
    attempts = []

    async def handler(request):
        attempts.append(1)
        if len(attempts) == 1:
            return httpx.Response(429)
        await asyncio.sleep(5)

    monkeypatch.setattr(tomtom, "TOMTOM_TIMEOUT_S", 0.05)
    serve(Provider.TOMTOM, handler)
    with pytest.raises(ProviderUnavailable):
        tomtom.routes(CHICAGO, DALLAS, 30_000, DEPART)
    assert len(attempts) == 2


def test_any_error_from_the_request_is_unavailable_without_a_chain(serve):
    def handler(request):
        raise RuntimeError(f"not an httpx error: {request.url}")

    serve(Provider.TOMTOM, handler)
    with pytest.raises(ProviderUnavailable) as caught:
        tomtom.routes(CHICAGO, DALLAS, 30_000, DEPART)
    assert caught.value.__cause__ is None
    assert caught.value.__context__ is None
