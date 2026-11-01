"""Finding the routes of a plan: the main TomTom call and, with fewer than 3 routes, the detour
round (architecture 6.4, spec 6.2).

The detour candidates are TomTom's raw tracks. They are never simplified here: the shared-road
and backtrack tests need the raw points (architecture 6.4 step 4).
"""

from dataclasses import dataclass, replace
from datetime import datetime
from decimal import Decimal

from core.constants import TOP_ROUTES
from planning import detours
from planning.track import RouteTrack
from providers import tomtom

LatLon = tuple[float, float]


@dataclass(frozen=True)
class RoutesResult:
    """The routes to rate and, when fewer than 3 exist, how many there are."""

    tracks: list[RouteTrack]
    fewer_routes: int | None


def find_routes(
    origin: LatLon,
    destination: LatLon,
    load_lb: int | float | Decimal,
    depart_at: datetime | None,
) -> RoutesResult:
    """The main call, then one parallel detour round when it gave fewer than 3 routes.

    Raises NoRoute when the main call finds no route, ProviderBudget(routing) when the round's
    calls do not fit the day's budget (before any detour call), and ProviderUnavailable(routing)
    when any call fails. A Waypoint with no route is just left out.

    `order` of the result is the index in the list: the API routes in TomTom's order, then the
    detours in the order they were kept. This is the tie order in ranking.
    """
    api_routes = tomtom.routes(origin, destination, load_lb, depart_at)
    if len(api_routes) >= TOP_ROUTES:
        tracks = list(api_routes)
    else:
        fastest = min(api_routes, key=lambda t: t.driving_s)
        points = detours.waypoints(fastest, origin, destination)
        answers = tomtom.detour_routes(origin, destination, load_lb, depart_at, points)
        candidates = [track for answer in answers if answer for track in answer]
        tracks = detours.apply_ladder(api_routes, candidates)
    tracks = [replace(track, order=i) for i, track in enumerate(tracks)]
    return RoutesResult(tracks, len(tracks) if len(tracks) < TOP_ROUTES else None)
