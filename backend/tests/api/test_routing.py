import asyncio
import copy
import functools
from datetime import UTC, datetime

import httpx
import pytest
from conftest import load_fixture

from api import routing
from core.constants import Provider, RouteSource, Service
from core.errors import NoRoute, ProviderBudget, ProviderUnavailable
from planning import detours
from providers import tomtom
from usage.models import ProviderDay

pytestmark = pytest.mark.django_db

CHICAGO = (41.8781, -87.62978)
DALLAS = (32.77667, -96.79699)
DEPART = datetime(2026, 11, 3, 14, 30, tzinfo=UTC)

MAIN = "tomtom_chicago_dallas_truck_alt5.json.gz"
WAYPOINT = "tomtom_chicago_dallas_waypoint_alt5.json.gz"


@functools.cache
def _saved(name: str) -> dict:
    return load_fixture(name)


def routes_of(name: str, keep: int | None = None, picks: list[int] | None = None) -> list[dict]:
    """Saved real routes, copied; the first `keep`, or the ones at `picks`."""
    routes = _saved(name)["routes"]
    chosen = [routes[i] for i in picks] if picks is not None else routes[:keep]
    return copy.deepcopy(chosen)


def is_detour_call(request: httpx.Request) -> bool:
    """A call through a Waypoint has 3 stops in its path, the main call 2."""
    return request.url.path.count(":") == 2


class Network:
    """A fake TomTom: answers the main call and the detour calls, and records what it saw."""

    def __init__(self, main, detour=None, delay: float = 0.0):
        self.main = main
        self.detour = detour
        self.delay = delay
        self.main_calls = 0
        self.detour_calls = 0
        self.in_flight = 0
        self.max_in_flight = 0

    async def __call__(self, request: httpx.Request) -> httpx.Response:
        self.in_flight += 1
        self.max_in_flight = max(self.max_in_flight, self.in_flight)
        try:
            await asyncio.sleep(self.delay)
            if is_detour_call(request):
                self.detour_calls += 1
                answer = self.detour
                if callable(answer):
                    answer = answer(self.detour_calls, request)
            else:
                self.main_calls += 1
                answer = self.main
            if isinstance(answer, httpx.Response):
                return answer
            return httpx.Response(200, json={"routes": answer})
        finally:
            self.in_flight -= 1


@pytest.fixture(autouse=True)
def tomtom_key(settings):
    settings.TOMTOM_API_KEY = "tt-test-key"


@pytest.fixture
def no_wait(monkeypatch):
    async def pause():
        pass

    monkeypatch.setattr(tomtom, "_pause", pause)


def find():
    return routing.find_routes(CHICAGO, DALLAS, 30_000, DEPART)


def tomtom_calls_today() -> int:
    return sum(ProviderDay.objects.filter(provider=Provider.TOMTOM).values_list("calls", flat=True))


def raw_points(route: dict) -> int:
    return sum(len(leg["points"]) for leg in route["legs"])


def test_three_routes_from_the_main_call_need_no_detour_round(serve):
    network = Network(routes_of(MAIN, 3))
    serve(Provider.TOMTOM, network)
    result = find()
    assert len(result.tracks) == 3
    assert result.fewer_routes is None
    assert network.main_calls == 1
    assert network.detour_calls == 0
    assert tomtom_calls_today() == 1
    assert [t.source for t in result.tracks] == [RouteSource.API] * 3
    assert [t.order for t in result.tracks] == [0, 1, 2]
    # The main call keeps TomTom's order, which is its own ranking.
    raw = routes_of(MAIN, 3)
    assert [round(t.dist_m[-1]) for t in result.tracks] == [
        r["summary"]["lengthInMeters"] for r in raw
    ]


def test_fewer_than_three_routes_run_the_detour_round_in_parallel_with_at_most_4_calls(serve):
    network = Network(routes_of(MAIN, 1), routes_of(WAYPOINT, 2), delay=0.05)
    serve(Provider.TOMTOM, network)
    result = find()
    assert network.main_calls == 1
    assert 1 <= network.detour_calls <= 4
    assert network.detour_calls == 4  # Chicago to Dallas has land on both sides
    # All the detour calls were in the air together.
    assert network.max_in_flight == network.detour_calls
    assert tomtom_calls_today() == 1 + network.detour_calls
    assert result.tracks[0].source == RouteSource.API


def test_a_detour_request_goes_through_a_waypoint_with_one_alternative(serve):
    seen = serve(Provider.TOMTOM, Network(routes_of(MAIN, 1), routes_of(WAYPOINT, 2)))
    find()
    detour_requests = [r for r in seen if is_detour_call(r)]
    assert {r.url.params["maxAlternatives"] for r in detour_requests} == {"1"}
    main = next(r for r in seen if not is_detour_call(r))
    assert main.url.params["maxAlternatives"] == "2"

    (api_route,) = tomtom.routes(CHICAGO, DALLAS, 30_000, DEPART)
    expected = detours.waypoints(api_route, CHICAGO, DALLAS)
    stops = [r.url.path.split("/calculateRoute/")[1].split("/json")[0] for r in detour_requests]
    assert sorted(stops) == sorted(
        f"{CHICAGO[0]},{CHICAGO[1]}:{lat},{lon}:{DALLAS[0]},{DALLAS[1]}" for lat, lon in expected
    )


def test_identical_detour_answers_are_not_kept_twice_and_a_backtracking_one_is_dropped(serve):
    serve(Provider.TOMTOM, Network(routes_of(MAIN, 1), routes_of(WAYPOINT, 2)))
    result = find()
    # 4 calls gave the same 2 routes; one of them runs 15 km back over its own road (the
    # Waypoint sat on the road), the other is fine and is kept once.
    assert len(result.tracks) == 2
    assert result.fewer_routes == 2
    first, second = result.tracks
    assert first.source == RouteSource.API
    assert second.source == RouteSource.DETOUR
    assert first.points != second.points


def test_kept_tracks_have_the_raw_point_counts_of_the_tomtom_answers(serve):
    serve(Provider.TOMTOM, Network(routes_of(MAIN, 1), routes_of(WAYPOINT, 2)))
    result = find()
    main_route = routes_of(MAIN, 1)[0]
    detour_route = routes_of(WAYPOINT, 2)[1]  # the first one backtracks and is not kept
    assert len(result.tracks[0].points) == raw_points(main_route)
    assert len(result.tracks[1].points) == raw_points(detour_route)


def test_order_is_renumbered_as_the_index_in_the_final_list(serve):
    # Every detour call answers with the main answer's 2nd and 3rd route: two distinct
    # detours that fit the ladder.
    serve(Provider.TOMTOM, Network(routes_of(MAIN, 1), routes_of(MAIN, picks=[1, 2])))
    result = find()
    assert len(result.tracks) == 3
    assert result.fewer_routes is None
    assert [t.order for t in result.tracks] == [0, 1, 2]
    assert [t.source for t in result.tracks] == [
        RouteSource.API,
        RouteSource.DETOUR,
        RouteSource.DETOUR,
    ]


def test_two_api_routes_then_detours_in_the_order_they_were_kept(serve):
    serve(Provider.TOMTOM, Network(routes_of(MAIN, picks=[0, 1]), routes_of(MAIN, picks=[2])))
    result = find()
    assert [t.order for t in result.tracks] == [0, 1, 2]
    assert [t.source for t in result.tracks] == [
        RouteSource.API,
        RouteSource.API,
        RouteSource.DETOUR,
    ]
    # One call can only ever give the one extra route needed, so the round stops at 3.
    assert len(result.tracks) == 3


def test_fewer_routes_is_the_count_when_no_detour_passes_the_ladder(serve):
    # The detour answers repeat the main route, which shares all its road.
    network = Network(routes_of(MAIN, 1), routes_of(MAIN, 1))
    serve(Provider.TOMTOM, network)
    result = find()
    assert len(result.tracks) == 1
    assert result.fewer_routes == 1
    assert network.detour_calls == 4


def test_a_waypoint_with_no_route_is_just_dropped(serve, fixture_bytes):
    no_route = fixture_bytes("tomtom_no_route.json")

    def answers(call, request):
        if call == 1:
            return httpx.Response(400, content=no_route)
        return routes_of(MAIN, picks=[1, 2])

    serve(Provider.TOMTOM, Network(routes_of(MAIN, 1), answers))
    result = find()
    assert len(result.tracks) == 3
    assert result.fewer_routes is None


def test_a_rejected_waypoint_is_dropped_and_the_others_are_used(serve, fixture_bytes):
    rejected = fixture_bytes("tomtom_map_matching_failure.json")

    def answers(call, request):
        if call == 1:
            return httpx.Response(400, content=rejected)
        return routes_of(MAIN, picks=[1, 2])

    serve(Provider.TOMTOM, Network(routes_of(MAIN, 1), answers))
    result = find()
    assert len(result.tracks) == 3
    assert result.fewer_routes is None


def test_more_routes_than_asked_for_are_trimmed_to_three_in_tomtoms_order(serve):
    network = Network(routes_of(MAIN, 4))
    serve(Provider.TOMTOM, network)
    result = find()
    assert network.detour_calls == 0
    assert len(result.tracks) == 3
    raw = routes_of(MAIN, 3)
    assert [round(t.dist_m[-1]) for t in result.tracks] == [
        r["summary"]["lengthInMeters"] for r in raw
    ]
    assert [t.order for t in result.tracks] == [0, 1, 2]


def test_every_waypoint_with_no_route_leaves_the_api_routes(serve, fixture_bytes):
    no_route = httpx.Response(400, content=fixture_bytes("tomtom_no_route.json"))
    serve(Provider.TOMTOM, Network(routes_of(MAIN, 1), no_route))
    result = find()
    assert len(result.tracks) == 1
    assert result.fewer_routes == 1


@pytest.mark.parametrize("failure", [httpx.Response(500), httpx.Response(200, text="not json")])
def test_a_detour_call_that_fails_is_provider_unavailable(serve, failure):
    def answers(call, request):
        return failure if call == 2 else routes_of(MAIN, picks=[1, 2])

    serve(Provider.TOMTOM, Network(routes_of(MAIN, 1), answers))
    with pytest.raises(ProviderUnavailable) as caught:
        find()
    assert caught.value.service == Service.ROUTING


def test_a_detour_call_that_times_out_is_provider_unavailable(serve, no_wait):
    def answers(call, request):
        raise httpx.ReadTimeout("slow")

    serve(Provider.TOMTOM, Network(routes_of(MAIN, 1), answers))
    with pytest.raises(ProviderUnavailable) as caught:
        find()
    assert caught.value.service == Service.ROUTING


def test_a_budget_refusal_before_the_detour_round_makes_no_detour_call(serve):
    network = Network(routes_of(MAIN, 1), routes_of(WAYPOINT, 2))
    serve(Provider.TOMTOM, network)
    today = datetime.now(UTC).date()
    # The main call takes the 650th call; the round needs 4 more and is refused whole.
    ProviderDay.objects.create(provider=Provider.TOMTOM, day=today, calls=649)
    with pytest.raises(ProviderBudget) as caught:
        find()
    assert caught.value.service == Service.ROUTING
    assert network.main_calls == 1
    assert network.detour_calls == 0
    assert tomtom_calls_today() == 650


def test_no_route_from_the_main_call_is_no_route(serve, fixture_bytes):
    no_route = httpx.Response(400, content=fixture_bytes("tomtom_no_route.json"))
    network = Network(no_route)
    serve(Provider.TOMTOM, network)
    with pytest.raises(NoRoute):
        find()
    assert network.detour_calls == 0


def test_a_main_call_failure_is_provider_unavailable_and_makes_no_detour_call(serve):
    network = Network(httpx.Response(500))
    serve(Provider.TOMTOM, network)
    with pytest.raises(ProviderUnavailable):
        find()
    assert network.detour_calls == 0
