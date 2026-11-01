"""The signed route bundle (architecture 6.13): the kept routes and the plan's settings.

An update reads the routes back from the bundle instead of asking the routing API again, so
the bundle is signed and bound to one user. Nothing is stored. Tracks are kept as an encoded
polyline plus the metres and seconds between points, as whole numbers.
"""

import math
import zlib
from dataclasses import dataclass
from datetime import UTC, datetime
from itertools import accumulate, pairwise
from zoneinfo import ZoneInfo

from django.core import signing
from django.utils import timezone

from core.constants import (
    BUNDLE_MAX_AGE,
    BUNDLE_SALT,
    BUNDLE_SIMPLIFY_M,
    BUNDLE_VERSION,
    INTERVAL_AUTO,
    INTERVALS_MI,
    TOP_ROUTES,
    LoadUnit,
    RouteSource,
)
from core.errors import BundleInvalid
from planning.geo import decode_polyline, encode_polyline
from planning.plan import PlaceInfo, PlanInputs
from planning.track import RouteTrack, simplify


@dataclass(frozen=True)
class Bundle:
    inputs: PlanInputs
    now_utc: datetime
    tracks: list[RouteTrack]


def _build_track(source: str, order: int, polyline: str, d: list, t: list) -> RouteTrack:
    """A track from its stored parts. Used by make_bundle and read_bundle alike, so a plan and
    an update see the very same numbers."""
    if not isinstance(d, list) or not isinstance(t, list):
        raise ValueError("the track columns must be lists")
    if not all(_is_int(v) for v in (*d, *t)):
        raise ValueError("the track columns must hold whole numbers")
    if any(v < 0 for v in (*d, *t)):
        raise ValueError("the track columns must not go back")
    if not isinstance(polyline, str) or not _is_int(order):
        raise ValueError("a track needs a polyline and an order")
    return RouteTrack(
        points=tuple(decode_polyline(polyline)),
        dist_m=tuple(float(v) for v in accumulate(d)),
        drive_s=tuple(float(v) for v in accumulate(t)),
        source=RouteSource(source),
        order=order,
    )


def _is_int(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _deltas(values: tuple[float, ...]) -> list[int]:
    whole = [round(v) for v in values]
    return [b - a for a, b in pairwise([0, *whole])]


def _place_to_json(place: PlaceInfo) -> dict:
    return {"label": place.label, "lat": place.lat, "lon": place.lon, "tz": place.tz}


def _place_from_json(data: dict) -> PlaceInfo:
    label, tz = data["label"], data["tz"]
    lat, lon = data["lat"], data["lon"]
    if not isinstance(label, str) or not isinstance(tz, str):
        raise ValueError("a place needs a label and a zone")
    try:
        ZoneInfo(tz)
    except (KeyError, ValueError, OSError):
        raise ValueError("not a time zone") from None
    if isinstance(lat, bool) or isinstance(lon, bool):
        raise ValueError("a place needs numbers")
    if not all(isinstance(v, int | float) and math.isfinite(v) for v in (lat, lon)):
        raise ValueError("a place needs numbers")
    return PlaceInfo(label, float(lat), float(lon), tz)


def _time_from_json(value: object) -> datetime:
    if not isinstance(value, str):
        raise ValueError("a time must be text")
    moment = datetime.fromisoformat(value)
    if moment.tzinfo is None:
        raise ValueError("a time must carry a time zone")
    return moment.astimezone(UTC)


def _inputs_to_json(inputs: PlanInputs) -> dict:
    return {
        "origin": _place_to_json(inputs.origin),
        "destination": _place_to_json(inputs.destination),
        "departure": inputs.departure_utc.astimezone(UTC).isoformat(),
        "load_lb": inputs.load_lb,
        "load_value": inputs.load_value,
        "load_unit": str(inputs.load_unit),
        "interval": inputs.interval,
        "hos": inputs.hos,
    }


def _inputs_from_json(data: dict) -> PlanInputs:
    interval = data["interval"]
    if interval != INTERVAL_AUTO and not (_is_int(interval) and interval in INTERVALS_MI):
        raise ValueError("not an Interval")
    if not isinstance(data["hos"], bool):
        raise ValueError("hos must be true or false")
    if not _is_int(data["load_lb"]) or not _is_int(data["load_value"]):
        raise ValueError("a load is a whole number")
    return PlanInputs(
        origin=_place_from_json(data["origin"]),
        destination=_place_from_json(data["destination"]),
        departure_utc=_time_from_json(data["departure"]),
        load_lb=data["load_lb"],
        load_value=data["load_value"],
        load_unit=LoadUnit(data["load_unit"]),
        interval=interval,
        hos=data["hos"],
    )


def make_bundle(
    user_id: object,
    inputs: PlanInputs,
    now_utc: datetime,
    tracks: list[RouteTrack],
    *,
    simplified: bool = False,
) -> tuple[str, list[RouteTrack]]:
    """The signed token and the tracks it holds.

    The tracks are simplified and rounded as they are stored, and the ones returned are read
    back from the stored form, so the plan built now and an update built later from the token
    agree to the last digit. Pass `simplified=True` for tracks that came out of a bundle: they
    are signed again as they are, because simplifying twice could drop one more point.
    """
    stored = []
    kept = []
    for track in tracks:
        small = track if simplified else simplify(track, BUNDLE_SIMPLIFY_M)
        entry = {
            "s": str(small.source),
            "o": small.order,
            "p": encode_polyline(list(small.points)),
            "d": _deltas(small.dist_m),
            "t": _deltas(small.drive_s),
        }
        stored.append(entry)
        kept.append(_build_track(entry["s"], entry["o"], entry["p"], entry["d"], entry["t"]))
    payload = {
        "v": BUNDLE_VERSION,
        "uid": str(user_id),
        "now": now_utc.astimezone(UTC).isoformat(),
        "inputs": _inputs_to_json(inputs),
        "tracks": stored,
    }
    return signing.dumps(payload, salt=BUNDLE_SALT, compress=True), kept


def read_bundle(token: str, user_id: object) -> Bundle:
    """The bundle in a token. Raises BundleInvalid for a bad signature, another version,
    another user, a plan older than BUNDLE_MAX_AGE or content that does not parse; unsigned
    data is never read."""
    try:
        payload = signing.loads(token, salt=BUNDLE_SALT)
        if not _is_int(payload["v"]) or payload["v"] != BUNDLE_VERSION:
            raise ValueError("not a bundle of this version")
        if payload["uid"] != str(user_id):
            raise ValueError("not this user's bundle")
        made = _time_from_json(payload["now"])
        if timezone.now() - made > BUNDLE_MAX_AGE:
            raise ValueError("the plan is too old to reuse")
        stored = payload["tracks"]
        if not isinstance(stored, list) or not 1 <= len(stored) <= TOP_ROUTES:
            raise ValueError("a bundle holds 1 to 3 routes")
        tracks = [_build_track(e["s"], e["o"], e["p"], e["d"], e["t"]) for e in stored]
        if len({t.order for t in tracks}) != len(tracks):
            raise ValueError("two routes share an order")
        return Bundle(
            inputs=_inputs_from_json(payload["inputs"]),
            now_utc=made,
            tracks=tracks,
        )
    except (
        signing.BadSignature,
        ValueError,
        KeyError,
        TypeError,
        AttributeError,
        IndexError,
        OverflowError,
        zlib.error,
    ):
        raise BundleInvalid() from None
