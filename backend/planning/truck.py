"""Where the truck is on a Route at each slider hour (architecture 6.12, spec S-2)."""

from dataclasses import dataclass
from datetime import datetime

from core.constants import HEATMAP_HOURS, METERS_PER_MILE, SECONDS_PER_HOUR, TruckStatus
from planning.checkpoints import require_aware
from planning.hos import Stop, state_at
from planning.track import RouteTrack


@dataclass(frozen=True)
class TruckPos:
    lat: float
    lon: float
    mile: float
    status: TruckStatus


def truck_at(track: RouteTrack, stops: list[Stop], offset_s: float) -> TruckPos:
    """The truck offset_s seconds after departure; an offset before departure counts as 0."""
    drive_s, status = state_at(max(offset_s, 0.0), stops, track.driving_s)
    lat, lon, dist_m = track.at_drive_s(drive_s)
    return TruckPos(lat, lon, dist_m / METERS_PER_MILE, status)


def truck_positions(
    track: RouteTrack, stops: list[Stop], departure_utc: datetime
) -> list[TruckPos]:
    """The truck at hours 0 to 48 after departure: still during a Stop, at the end once arrived."""
    require_aware(departure_utc)
    return [truck_at(track, stops, h * SECONDS_PER_HOUR) for h in range(HEATMAP_HOURS)]
