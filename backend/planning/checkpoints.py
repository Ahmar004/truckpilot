"""Checkpoint placement along a Route and the forecast hour each one uses (spec 7, 9.1)."""

import math
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from core.constants import (
    AUTO_LONG_ABOVE_MI,
    AUTO_SHORT_BELOW_MI,
    FORECAST_WINDOW_H,
    INTERVAL_LONG_MI,
    INTERVAL_MEDIUM_MI,
    INTERVAL_SHORT_MI,
    METERS_PER_MILE,
)
from planning.hos import Stop, eta
from planning.track import RouteTrack
from planning.zones import zone_at


def _timezone_at(lat: float, lon: float) -> str:
    tz = zone_at(lat, lon)
    if tz is None:
        raise ValueError(f"no time zone for point {lat}, {lon}")
    return tz


def _require_aware(moment: datetime) -> None:
    if moment.tzinfo is None:
        raise ValueError("a time must carry a time zone")


def _round_half_up(x: float) -> int:
    return math.floor(x + 0.5)


def auto_interval(length_mi: float) -> int:
    """Checkpoint interval for a Route length (spec 7.1)."""
    if length_mi < AUTO_SHORT_BELOW_MI:
        return INTERVAL_SHORT_MI
    if length_mi <= AUTO_LONG_ABOVE_MI:
        return INTERVAL_MEDIUM_MI
    return INTERVAL_LONG_MI


@dataclass(frozen=True)
class CheckpointPos:
    n: int
    mile: int
    of_mi: int
    lat: float
    lon: float
    covered_mi: float
    drive_s: float
    eta_utc: datetime
    tz: str


def place_checkpoints(
    track: RouteTrack, interval_mi: int, departure_utc: datetime, stops: list[Stop]
) -> list[CheckpointPos]:
    """Mile 0, every interval mark below the route length, then the destination (spec 7.2)."""
    if interval_mi <= 0:
        raise ValueError("the interval must be above 0")
    _require_aware(departure_utc)
    length_m = track.dist_m[-1]
    of_mi = _round_half_up(track.length_mi)

    marks_mi = [0]
    mark = interval_mi
    while mark * METERS_PER_MILE < length_m:
        marks_mi.append(mark)
        mark += interval_mi
    dists = [mi * METERS_PER_MILE for mi in marks_mi] + [length_m]
    miles = marks_mi + [of_mi]

    result = []
    for i, (d, mile) in enumerate(zip(dists, miles, strict=True)):
        back = d - dists[i - 1] if i > 0 else 0.0
        forward = dists[i + 1] - d if i + 1 < len(dists) else 0.0
        lat, lon, drive_s = track.at_distance(d)
        result.append(
            CheckpointPos(
                n=i + 1,
                mile=mile,
                of_mi=of_mi,
                lat=lat,
                lon=lon,
                covered_mi=(back + forward) / 2 / METERS_PER_MILE,
                drive_s=drive_s,
                eta_utc=eta(departure_utc, drive_s, stops),
                tz=_timezone_at(lat, lon),
            )
        )
    return result


def forecast_hour(eta_utc: datetime) -> datetime:
    """The ETA rounded to the nearest whole UTC hour; half past goes up."""
    _require_aware(eta_utc)
    eta_utc = eta_utc.astimezone(UTC)
    base = eta_utc.replace(minute=0, second=0, microsecond=0)
    if (eta_utc - base) * 2 >= timedelta(hours=1):
        base += timedelta(hours=1)
    return base


def in_window(hour_utc: datetime, now_utc: datetime) -> bool:
    """True when the forecast hour is inside the forecast window (spec 7.6)."""
    _require_aware(hour_utc)
    _require_aware(now_utc)
    return hour_utc <= now_utc + timedelta(hours=FORECAST_WINDOW_H)
