"""The heatmap corridor and its cells (architecture 6.11, spec 10)."""

from collections.abc import Collection, Mapping
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal

from core.constants import (
    CAUSE_BITS,
    CORRIDOR_SAMPLE_M,
    HEATMAP_HOURS,
    LEVEL_NO_DATA_CHAR,
    LOAD_RULE_BIT,
)
from planning.checkpoints import forecast_hour, in_window, require_aware
from planning.risk import rate
from planning.track import RouteTrack
from weather.cells import cell_index, key_of
from weather.forecast import Forecast


def corridor(tracks: list[RouteTrack], cell_deg: Decimal, ring: bool) -> set[tuple[int, int]]:
    """The (i, j) cells that the routes cross, plus one ring of cells around them if asked.

    Each route is sampled every CORRIDOR_SAMPLE_M metres, and at its end. Cell i is
    floor(lat / cell_deg) and j is floor(lon / cell_deg), the same cells as the forecast cache.
    """
    cells: set[tuple[int, int]] = set()
    for track in tracks:
        length_m = track.dist_m[-1]
        d = 0.0
        while True:
            lat, lon, _ = track.at_distance(d)
            cells.add(cell_index(lat, lon, cell_deg))
            if d >= length_m:
                break
            d = min(d + CORRIDOR_SAMPLE_M, length_m)
    if not ring:
        return cells
    return {(i + di, j + dj) for i, j in cells for di in (-1, 0, 1) for dj in (-1, 0, 1)}


@dataclass(frozen=True)
class HeatmapHour:
    utc: datetime
    in_window: bool


@dataclass(frozen=True)
class HeatmapCell:
    """lv has one character per hour: the Level score "0".."4", or "-" for no data.

    cz has one cause bitmask per hour (CAUSE_BITS, plus LOAD_RULE_BIT); 0 for Low and no data.
    """

    i: int
    j: int
    lv: str
    cz: tuple[int, ...]


@dataclass(frozen=True)
class Heatmap:
    cell_deg: Decimal
    hours: tuple[HeatmapHour, ...]
    cells: tuple[HeatmapCell, ...]


def heatmap(
    cells: Collection[tuple[int, int]],
    forecasts: Mapping[str, Forecast],
    departure_utc: datetime,
    now_utc: datetime,
    load_lb: int,
    cell_deg: Decimal,
) -> Heatmap | None:
    """The risk of every cell for hours 0 to 48 after departure (architecture 6.11).

    forecasts is keyed by cell key (weather.cells), each forecast taken at the cell centre.
    None when hour 0 is already past the forecast window.
    """
    require_aware(departure_utc)
    require_aware(now_utc)
    hours = []
    for h in range(HEATMAP_HOURS):
        utc = departure_utc + timedelta(hours=h)
        fh = forecast_hour(utc)
        hours.append((HeatmapHour(utc, in_window(fh, now_utc)), fh))
    if not hours[0][0].in_window:
        return None

    result = []
    for i, j in sorted(cells):
        forecast = forecasts[key_of(cell_deg, i, j)]
        levels = []
        causes = []
        for hour, fh in hours:
            values = forecast.at(fh) if hour.in_window else None
            if values is None:
                levels.append(LEVEL_NO_DATA_CHAR)
                causes.append(0)
                continue
            rating = rate(*values, load_lb)
            levels.append(str(int(rating.level)))
            mask = sum(CAUSE_BITS[c] for c in rating.causes)
            causes.append(mask | (LOAD_RULE_BIT if rating.load_rule else 0))
        result.append(HeatmapCell(i, j, "".join(levels), tuple(causes)))
    return Heatmap(cell_deg, tuple(h for h, _ in hours), tuple(result))
