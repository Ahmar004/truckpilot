"""Hours of service timeline (spec 7.3): breaks, rests and the ETAs they push back."""

from dataclasses import dataclass
from datetime import datetime, timedelta

from core.constants import (
    HOS_BREAK_AFTER_DRIVE_S,
    HOS_BREAK_DURATION_S,
    HOS_REST_AFTER_DRIVE_S,
    HOS_REST_DURATION_S,
    StopKind,
    TruckStatus,
)


@dataclass(frozen=True)
class Stop:
    """A break or rest that begins after at_drive_s seconds of driving."""

    at_drive_s: float
    duration_s: float
    kind: StopKind


def stops(total_drive_s: float, hos_on: bool) -> list[Stop]:
    """The breaks and rests on a trip. A rest wins when both are due at the same second.

    A stop due at or after total_drive_s is not taken: the destination is reached first.
    """
    if not hos_on:
        return []
    result: list[Stop] = []
    last_break = last_rest = 0.0
    while True:
        break_due = last_break + HOS_BREAK_AFTER_DRIVE_S
        rest_due = last_rest + HOS_REST_AFTER_DRIVE_S
        if rest_due <= break_due:
            at, kind, duration = rest_due, StopKind.REST, HOS_REST_DURATION_S
        else:
            at, kind, duration = break_due, StopKind.BREAK, HOS_BREAK_DURATION_S
        if at >= total_drive_s:
            return result
        result.append(Stop(at, duration, kind))
        last_break = at
        if kind == StopKind.REST:
            last_rest = at


def eta(departure_utc: datetime, drive_s: float, stops: list[Stop]) -> datetime:
    """Arrival time after drive_s seconds of driving. Stops strictly before it are included."""
    waiting = sum(s.duration_s for s in stops if s.at_drive_s < drive_s)
    return departure_utc + timedelta(seconds=drive_s + waiting)


def state_at(offset_s: float, stops: list[Stop], total_drive_s: float) -> tuple[float, TruckStatus]:
    """Driving seconds done and the status, offset_s wall-clock seconds after departure."""
    total_wall = total_drive_s + sum(s.duration_s for s in stops)
    if offset_s >= total_wall:
        return total_drive_s, TruckStatus.ARRIVED
    waited = 0.0
    for s in stops:
        start = s.at_drive_s + waited
        if offset_s < start:
            break
        if offset_s < start + s.duration_s:
            return s.at_drive_s, TruckStatus(s.kind.value)
        waited += s.duration_s
    return offset_s - waited, TruckStatus.DRIVING
