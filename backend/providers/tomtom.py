"""TomTom truck routing (architecture 6.4, tech-stack 10).

`routes` is the blocking call a view makes: it reserves one TomTom call, then runs the request.
`routes_async` is the request itself, with no database work, so the detour round can reserve
its calls first and then run several of them at once in one `asyncio.run`.

Every failure is ProviderUnavailable or NoRoute. The request URL holds the API key, so no
error ever carries the URL, the response text or the httpx exception that raised it.
"""

import asyncio
import logging
import random
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal
from itertools import pairwise

import httpx
from django.conf import settings
from pydantic import BaseModel

from core.constants import (
    KG_PER_LB,
    MAIN_MAX_ALTERNATIVES,
    TOMTOM_RETRY_WAIT_MAX_S,
    TOMTOM_RETRY_WAIT_MIN_S,
    TOMTOM_ROUTING_URL,
    TOMTOM_TIMEOUT_S,
    Provider,
    RouteSource,
    Service,
)
from core.errors import NoRoute, ProviderUnavailable
from planning.geo import haversine_m
from planning.track import RouteTrack
from providers import transport
from usage import limits

NO_ROUTE_CODE = "NO_ROUTE_FOUND"

logger = logging.getLogger(__name__)

LatLon = tuple[float, float]


class _Point(BaseModel):
    latitude: float
    longitude: float


class _Leg(BaseModel):
    points: list[_Point]


class _Anchor(BaseModel):
    """TomTom's running total at one route point (extendedRouteRepresentation)."""

    pointIndex: int
    distanceInMeters: float
    travelTimeInSeconds: float


class _Route(BaseModel):
    legs: list[_Leg]
    progress: list[_Anchor]


class _Answer(BaseModel):
    routes: list[_Route]


def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        timeout=TOMTOM_TIMEOUT_S, transport=transport.transport_for(Provider.TOMTOM)
    )


def _kilograms(load_lb: int | float | Decimal) -> int:
    """The load in whole kilograms, rounded half up (30,000 lb is 13,608 kg)."""
    kg = Decimal(str(load_lb)) * KG_PER_LB
    return int(kg.quantize(Decimal(1), rounding=ROUND_HALF_UP))


def _depart_param(depart_at: datetime | None) -> str:
    if depart_at is None:
        return "now"
    if depart_at.tzinfo is None:
        raise ValueError("depart_at needs a time zone")
    return depart_at.astimezone(UTC).replace(microsecond=0).isoformat()


async def _pause() -> None:
    await asyncio.sleep(random.uniform(TOMTOM_RETRY_WAIT_MIN_S, TOMTOM_RETRY_WAIT_MAX_S))


async def _get(client: httpx.AsyncClient, url: str, params: list) -> httpx.Response | None:
    """The response, or None when the request could not be made or finished in time.

    The time limit covers the whole attempt (connect, send and the full body), unlike httpx's
    own timeout, which is per phase. Any error becomes None so none can carry the URL (it
    holds the API key).
    """
    try:
        async with asyncio.timeout(TOMTOM_TIMEOUT_S):
            return await client.get(url, params=params)
    except Exception as exc:
        transport.log_failure(logger, Service.ROUTING, exc)
        return None


def _error_code(response: httpx.Response) -> str | None:
    """TomTom's detailedError.code, when the body has one."""
    try:
        return response.json()["detailedError"]["code"]
    except (ValueError, KeyError, TypeError):
        return None


def _fill(values: list[float], points: list[LatLon], a: _Anchor, b: _Anchor, attr: str) -> None:
    """Set `values` from anchor a to anchor b, by each point's share of the distance walked."""
    start, end = a.pointIndex, b.pointIndex
    walked = [0.0]
    for k in range(start, end):
        walked.append(walked[-1] + haversine_m(*points[k], *points[k + 1]))
    total = walked[-1]
    low, high = getattr(a, attr), getattr(b, attr)
    for n, k in enumerate(range(start, end)):
        share = walked[n] / total if total else 0.0
        values[k] = min(low + (high - low) * share, high)
    values[end] = high


def _track(route: _Route, source: RouteSource, order: int) -> RouteTrack | None:
    """The route as a RouteTrack, or None when TomTom's progress does not fit its points.

    TomTom's pointIndex counts the points of all legs joined as they are: the point where two
    legs meet is in both, so it is kept twice (checked on the saved Waypoint answer).
    """
    points = [(p.latitude, p.longitude) for leg in route.legs for p in leg.points]
    anchors = route.progress
    first, last = (anchors[0], anchors[-1]) if anchors else (None, None)
    if (
        len(points) < 2
        or len(anchors) < 2
        or first.pointIndex != 0
        or last.pointIndex != len(points) - 1
        or first.distanceInMeters != 0
        or first.travelTimeInSeconds != 0
    ):
        return None
    for a, b in pairwise(anchors):
        if (
            b.pointIndex <= a.pointIndex
            or b.distanceInMeters < a.distanceInMeters
            or b.travelTimeInSeconds < a.travelTimeInSeconds
        ):
            return None
    dist = [0.0] * len(points)
    drive = [0.0] * len(points)
    for a, b in pairwise(anchors):
        _fill(dist, points, a, b, "distanceInMeters")
        _fill(drive, points, a, b, "travelTimeInSeconds")
    try:
        return RouteTrack(
            points=tuple(points),
            dist_m=tuple(dist),
            drive_s=tuple(drive),
            source=source,
            order=order,
        )
    except ValueError:
        return None


async def routes_async(
    origin: LatLon,
    destination: LatLon,
    load_lb: int | float | Decimal,
    depart_at: datetime | None,
    waypoint: LatLon | None = None,
    max_alternatives: int = MAIN_MAX_ALTERNATIVES,
) -> list[RouteTrack]:
    """One Calculate Route call: the best route plus up to `max_alternatives` more.

    Reserves nothing; the caller reserves first (see `routes`). A route through a Waypoint is
    a DETOUR source. A 429 waits a random 0.3-0.6 s and retries once.
    """
    stops = [origin, *([waypoint] if waypoint else []), destination]
    path = ":".join(f"{lat},{lon}" for lat, lon in stops)
    params = [
        ("key", settings.TOMTOM_API_KEY),
        ("travelMode", "truck"),
        ("vehicleWeight", _kilograms(load_lb)),
        ("maxAlternatives", max_alternatives),
        ("routeType", "fastest"),
        ("traffic", "true"),
        ("departAt", _depart_param(depart_at)),
        ("routeRepresentation", "polyline"),
        # TomTom wants the parameter repeated, not comma-separated.
        ("extendedRouteRepresentation", "distance"),
        ("extendedRouteRepresentation", "travelTime"),
    ]
    url = f"{TOMTOM_ROUTING_URL}/{path}/json"
    async with _client() as client:
        response = await _get(client, url, params)
        if response is not None and response.status_code == httpx.codes.TOO_MANY_REQUESTS:
            await _pause()
            response = await _get(client, url, params)
    if response is not None and response.status_code == httpx.codes.BAD_REQUEST:
        if _error_code(response) == NO_ROUTE_CODE:
            raise NoRoute()
    if response is None or response.status_code != httpx.codes.OK:
        if response is not None:
            transport.log_failure(logger, Service.ROUTING, status=response.status_code)
        raise ProviderUnavailable(Service.ROUTING)
    try:
        answer = _Answer.model_validate_json(response.content)
    except ValueError:
        answer = None
    source = RouteSource.DETOUR if waypoint else RouteSource.API
    tracks = [_track(r, source, i) for i, r in enumerate(answer.routes)] if answer else []
    if not tracks or any(t is None for t in tracks):
        raise ProviderUnavailable(Service.ROUTING)
    return tracks


def routes(
    origin: LatLon,
    destination: LatLon,
    load_lb: int | float | Decimal,
    depart_at: datetime | None,
    waypoint: LatLon | None = None,
    max_alternatives: int = MAIN_MAX_ALTERNATIVES,
) -> list[RouteTrack]:
    """Reserve one TomTom call (ProviderBudget when the day's budget is used), then call it.

    `depart_at` is an aware datetime sent in UTC, or None for "now". Raises NoRoute or
    ProviderUnavailable(routing).
    """
    limits.reserve(Provider.TOMTOM, 1)
    return asyncio.run(
        routes_async(origin, destination, load_lb, depart_at, waypoint, max_alternatives)
    )
