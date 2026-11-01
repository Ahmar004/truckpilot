"""The weather-location cap: which Interval a plan can afford and how fine its heatmap is.

Each plan uses at most MAX_WEATHER_LOCATIONS forecast locations (architecture 6.5). Every
count here comes from the routes' geometry and times alone, never from what is cached, so the
same trip always gets the same Interval and grid.
"""

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from core.constants import (
    CELL_DEG_CHECKPOINT,
    CELL_DEGS_HEATMAP,
    INTERVAL_AUTO,
    INTERVALS_MI,
    MAX_WEATHER_LOCATIONS,
)
from planning.checkpoints import auto_interval, forecast_hour, in_window, place_checkpoints
from planning.heatmap import corridor
from planning.hos import stops
from planning.track import RouteTrack
from weather.cells import cell_key


@dataclass(frozen=True)
class IntervalOption:
    mi: int
    allowed: bool


@dataclass(frozen=True)
class IntervalChoice:
    """The Interval used, the one asked for when it had to be raised (else None), all options."""

    used_mi: int
    requested_mi: int | None
    options: tuple[IntervalOption, ...]


def checkpoint_cells(
    tracks: list[RouteTrack],
    interval_mi: int,
    departure_utc: datetime,
    now_utc: datetime,
    hos_on: bool,
) -> set[str]:
    """The distinct 0.1-degree cells of the Checkpoints whose forecast hour is in the window."""
    cells: set[str] = set()
    for track in tracks:
        route_stops = stops(track.driving_s, hos_on)
        for cp in place_checkpoints(track, interval_mi, departure_utc, route_stops):
            if in_window(forecast_hour(cp.eta_utc), now_utc):
                cells.add(cell_key(cp.lat, cp.lon, CELL_DEG_CHECKPOINT))
    return cells


def interval_choice(
    tracks: list[RouteTrack],
    requested: str | int,
    departure_utc: datetime,
    now_utc: datetime,
    hos_on: bool,
) -> IntervalChoice:
    """Pick the Interval (architecture 6.5 steps 1 to 4) for all the kept routes.

    requested is INTERVAL_AUTO or one of INTERVALS_MI. An Interval is allowed when its
    Checkpoint cells C plus the heatmap cells at the coarsest size H2 fit the cap; the
    coarsest Interval is always allowed. A requested Interval that is not allowed is raised
    to the next larger allowed one.
    """
    if requested == INTERVAL_AUTO:
        fastest = min(tracks, key=lambda t: t.driving_s)
        wanted = auto_interval(fastest.length_mi)
    elif requested in INTERVALS_MI:
        wanted = int(requested)
    else:
        raise ValueError(f"not an Interval: {requested!r}")

    if in_window(forecast_hour(departure_utc), now_utc):
        coarsest_cells = len(corridor(tracks, CELL_DEGS_HEATMAP[-1], ring=True))
    else:
        coarsest_cells = 0

    coarsest_mi = INTERVALS_MI[-1]
    options = tuple(
        IntervalOption(
            mi=mi,
            allowed=mi == coarsest_mi
            or len(checkpoint_cells(tracks, mi, departure_utc, now_utc, hos_on)) + coarsest_cells
            <= MAX_WEATHER_LOCATIONS,
        )
        for mi in INTERVALS_MI
    )
    used = next(o.mi for o in options if o.mi >= wanted and o.allowed)
    return IntervalChoice(
        used_mi=used, requested_mi=wanted if used != wanted else None, options=options
    )


def heatmap_grid(c_count: int, shown_tracks: list[RouteTrack]) -> tuple[Decimal, bool]:
    """The heatmap cell size and whether it has a ring (architecture 6.5 step 5).

    c_count is the Checkpoint cells of all kept routes. The smallest size whose corridor,
    ring included, fits the cap is used. If even the coarsest does not fit, it is used
    without the ring.
    """
    for deg in CELL_DEGS_HEATMAP:
        if c_count + len(corridor(shown_tracks, deg, ring=True)) <= MAX_WEATHER_LOCATIONS:
            return deg, True
    return CELL_DEGS_HEATMAP[-1], False
