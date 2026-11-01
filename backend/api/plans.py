"""The plan and update endpoints (architecture 6.1, 6.2, 6.13, 6.14, 6.15).

The API layer checks the input, records the user's usage and calls the providers; the rules
are all in `planning/`. A plan and an update run the very same `build_plan` on the bundle's
tracks, so with the same settings they give the same numbers.
"""

import logging
import re
import time
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from zoneinfo import ZoneInfo

from django.http import HttpRequest
from django.utils import timezone
from ninja import Router

from api import places, routing
from api.schemas import PlanOut, PlanRequest, UpdateRequest, plan_out
from core.constants import (
    DEPARTURE_GRACE_S,
    INTERVAL_AUTO,
    INTERVALS_MI,
    KG_PER_LB,
    LOAD_MAX_KG,
    LOAD_MAX_LB,
    SAME_PLACE_M,
    ErrorCode,
    FieldCode,
    LoadUnit,
)
from core.errors import ApiError, NoRoute
from planning import bundle as route_bundle
from planning import plan as rules
from planning.geo import haversine_m
from planning.plan import PlaceInfo, PlanInputs
from planning.track import RouteTrack
from usage import limits
from weather import cache

logger = logging.getLogger(__name__)
router = Router()

# A departure is a wall time such as 2026-11-03T13:00 (seconds are allowed) with no zone.
_WALL_TIME = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?")
_GRACE = timedelta(seconds=DEPARTURE_GRACE_S)


def departure_utc(text: str, tz: str) -> datetime:
    """A wall time read in a zone, as UTC. A time in a clock gap or overlap is read with
    fold=0, the earlier reading. Raises ValueError when it is not a wall time."""
    if not _WALL_TIME.fullmatch(text):
        raise ValueError("not a wall time")
    wall = datetime.fromisoformat(text).replace(tzinfo=ZoneInfo(tz), fold=0)
    try:
        return wall.astimezone(UTC)
    except OverflowError:
        raise ValueError("out of range") from None


def load_in_pounds(value: int, unit: LoadUnit) -> int | None:
    """The load in whole pounds (kg rounded half up), or None when it is out of range."""
    if unit == LoadUnit.KG:
        if not 0 <= value <= LOAD_MAX_KG:
            return None
        return int((Decimal(value) / KG_PER_LB).quantize(Decimal(1), rounding=ROUND_HALF_UP))
    return value if 0 <= value <= LOAD_MAX_LB else None


def _interval_valid(interval: str | int) -> bool:
    return interval == INTERVAL_AUTO or (
        isinstance(interval, int) and not isinstance(interval, bool) and interval in INTERVALS_MI
    )


def _invalid(fields: dict[str, str]) -> ApiError:
    return ApiError(ErrorCode.INVALID_INPUT, 422, fields=fields)


def _same_place(a: tuple[str, PlaceInfo], b: tuple[str, PlaceInfo]) -> bool:
    (id_a, place_a), (id_b, place_b) = a, b
    apart_m = haversine_m(place_a.lat, place_a.lon, place_b.lat, place_b.lon)
    return id_a == id_b or apart_m < SAME_PLACE_M


def _plan_inputs(payload: PlanRequest, now: datetime) -> PlanInputs:
    """Check the request in the order of architecture 6.1; the first kind of failure answers."""
    bad = {}
    chosen = {}
    for field in ("origin", "destination"):
        try:
            chosen[field] = places.read_token(getattr(payload, field))
        except places.BadPlace:
            bad[field] = FieldCode.PICK_PLACE
    if bad:
        raise _invalid(bad)
    origin, destination = chosen["origin"], chosen["destination"]
    if _same_place(origin, destination):
        raise ApiError(ErrorCode.SAME_PLACE, 422)

    fields = {}
    load_lb = load_in_pounds(payload.load.value, payload.load.unit)
    if load_lb is None:
        fields["load"] = FieldCode.LOAD_RANGE
    if not _interval_valid(payload.interval):
        fields["interval"] = FieldCode.INVALID
    departure = None
    try:
        departure = departure_utc(payload.departure_local, origin[1].tz)
    except ValueError:
        fields["departure_local"] = FieldCode.INVALID
    if fields:
        raise _invalid(fields)
    if departure < now - _GRACE:
        raise ApiError(ErrorCode.DEPARTURE_PASSED, 422)
    return PlanInputs(
        origin=origin[1],
        destination=destination[1],
        departure_utc=departure,
        load_lb=load_lb,
        load_value=payload.load.value,
        load_unit=payload.load.unit,
        interval=payload.interval,
        hos=payload.hos,
    )


class _TimedForecasts:
    """The forecast cache with a stopwatch on it, so the log can split weather from rules.

    It calls the cache with the keys only: the cache reads its own clock, never the plan's now.
    """

    def __init__(self) -> None:
        self.seconds = 0.0

    def __call__(self, keys: list[str]):
        started = time.perf_counter()
        try:
            return cache.get_forecasts(keys)
        finally:
            self.seconds += time.perf_counter() - started


def _answer(
    kind: str,
    started: float,
    routing_s: float,
    tracks: list[RouteTrack],
    inputs: PlanInputs,
    now: datetime,
    fewer_routes: int | None,
    token: str,
) -> dict:
    """Run the rules and give the answer. Logs one line of phase times in milliseconds; the
    line carries no trip input (architecture 6.15)."""
    forecasts = _TimedForecasts()
    answer = plan_out(rules.build_plan(tracks, inputs, now, forecasts, fewer_routes), token)
    total_s = time.perf_counter() - started
    logger.info(
        "%s routing_ms=%d weather_ms=%d rules_ms=%d total_ms=%d",
        kind,
        routing_s * 1000,
        forecasts.seconds * 1000,
        (total_s - routing_s - forecasts.seconds) * 1000,
        total_s * 1000,
    )
    return answer


@router.post("/plans", response=PlanOut)
def create_plan(request: HttpRequest, payload: PlanRequest):
    started = time.perf_counter()
    user = request.user
    now = timezone.now()
    inputs = _plan_inputs(payload, now)
    event = limits.record_plan(user)
    try:
        # Under 60 s away (or already past, inside the grace) TomTom is asked for "now".
        leaving_now = inputs.departure_utc - now < _GRACE
        found = routing.find_routes(
            (inputs.origin.lat, inputs.origin.lon),
            (inputs.destination.lat, inputs.destination.lon),
            inputs.load_lb,
            None if leaving_now else inputs.departure_utc,
        )
        routing_s = time.perf_counter() - started
        token, tracks = route_bundle.make_bundle(user.id, inputs, now, found.tracks)
        return _answer("plan", started, routing_s, tracks, inputs, now, found.fewer_routes, token)
    except NoRoute:
        raise  # a real answer: the plan stays counted
    except Exception:
        # A provider budget or failure, or a bug: the driver is not charged (spec 4).
        limits.refund(event)
        raise


@router.post("/plans/update", response=PlanOut)
def update_plan(request: HttpRequest, payload: UpdateRequest):
    started = time.perf_counter()
    user = request.user
    bundle = route_bundle.read_bundle(payload.bundle, user.id)
    if not _interval_valid(payload.interval):
        raise _invalid({"interval": FieldCode.INVALID})
    event = limits.record_update(user)
    if bundle.inputs.departure_utc < timezone.now() - _GRACE:
        limits.refund(event)
        raise ApiError(ErrorCode.DEPARTURE_PASSED, 422)
    inputs = replace(bundle.inputs, interval=payload.interval, hos=payload.hos)
    # The bundle's own tracks are signed again as they are; its `now` stays the plan's now.
    token, tracks = route_bundle.make_bundle(
        user.id, inputs, bundle.now_utc, bundle.tracks, simplified=True
    )
    return _answer(
        "update",
        started,
        0.0,
        tracks,
        inputs,
        bundle.now_utc,
        routing.fewer_routes_notice(len(tracks)),
        token,
    )
