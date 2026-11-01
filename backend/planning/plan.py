"""Plan assembly: the rules of architecture 6.5 to 6.12 run in order on the kept routes.

Pure: no provider, no database. The forecasts come in through get_forecasts, so a plan and an
update (architecture 6.14) run the very same code on the same tracks.
"""

from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal

from core.constants import (
    CELL_DEG_CHECKPOINT,
    FORECAST_WINDOW_H,
    INTERVAL_AUTO,
    TOP_ROUTES,
    Cause,
    IntervalMode,
    Level,
    LoadUnit,
    Recommendation,
    RouteSource,
)
from planning.checkpoints import CheckpointPos, forecast_hour, in_window, place_checkpoints
from planning.geo import encode_polyline
from planning.heatmap import Heatmap, corridor, heatmap
from planning.hos import Stop, stops
from planning.ranking import RatedCheckpoint, RouteSummary, rank, route_numbers
from planning.risk import Rating, rate
from planning.track import RouteTrack
from planning.truck import TruckPos, truck_positions
from planning.weather_budget import IntervalOption, heatmap_grid, interval_choice
from weather.cells import cell_key, key_of
from weather.forecast import Forecast

GetForecasts = Callable[[list[str]], Mapping[str, Forecast]]


@dataclass(frozen=True)
class PlaceInfo:
    label: str
    lat: float
    lon: float
    tz: str


@dataclass(frozen=True)
class PlanInputs:
    """What the driver asked for. load_lb is what the rules use; load_value and load_unit are
    the load as typed, echoed back as typed. interval is INTERVAL_AUTO or a number of miles."""

    origin: PlaceInfo
    destination: PlaceInfo
    departure_utc: datetime
    load_lb: int
    load_value: int
    load_unit: LoadUnit
    interval: str | int
    hos: bool


@dataclass(frozen=True)
class Weather:
    wind_mph: Decimal
    rain_in: Decimal
    snow_in: Decimal


@dataclass(frozen=True)
class Checkpoint:
    """weather and level are None for No weather data."""

    n: int
    mile: int
    of_mi: int
    lat: float
    lon: float
    covered_mi: float
    eta_utc: datetime
    tz: str
    forecast_utc: datetime
    weather: Weather | None
    level: Level | None
    causes: tuple[Cause, ...]
    load_rule: bool


@dataclass(frozen=True)
class Route:
    id: str
    rank: int
    recommendation: Recommendation | None
    source: RouteSource
    distance_mi: float
    driving_s: float
    travel_s: float
    arrival_utc: datetime
    arrival_tz: str
    miles: dict[Level, float]
    no_data_mi: float
    average_risk: Decimal | None
    line: str
    checkpoints: tuple[Checkpoint, ...]
    truck: tuple[TruckPos, ...]


@dataclass(frozen=True)
class Trip:
    origin: PlaceInfo
    destination: PlaceInfo
    departure_utc: datetime
    load_lb: int
    load_value: int
    load_unit: LoadUnit
    hos: bool


@dataclass(frozen=True)
class IntervalBlock:
    mode: IntervalMode
    used_mi: int
    requested_mi: int | None
    options: tuple[IntervalOption, ...]


@dataclass(frozen=True)
class Notices:
    fewer_routes: int | None
    do_not_travel: bool


@dataclass(frozen=True)
class Plan:
    """The plan without its signed bundle; the endpoint adds the bundle token."""

    now_utc: datetime
    window_end_utc: datetime
    trip: Trip
    interval: IntervalBlock
    notices: Notices
    routes: tuple[Route, ...]
    heatmap: Heatmap | None


@dataclass(frozen=True)
class _Placed:
    """One route with its HOS stops and Checkpoint positions, before any weather is known."""

    track: RouteTrack
    stops: list[Stop]
    positions: list[CheckpointPos]


def _checkpoint_key(pos: CheckpointPos) -> str:
    return cell_key(pos.lat, pos.lon, CELL_DEG_CHECKPOINT)


def _rated(
    pos: CheckpointPos,
    now_utc: datetime,
    load_lb: int,
    forecasts: Mapping[str, Forecast],
) -> tuple[Weather | None, Rating | None]:
    """The weather and rating at a Checkpoint; None for both when it has no weather data."""
    hour = forecast_hour(pos.eta_utc)
    if not in_window(hour, now_utc):
        return None, None
    values = forecasts[_checkpoint_key(pos)].at(hour)
    if values is None:
        return None, None
    return Weather(*values), rate(*values, load_lb)


def build_plan(
    tracks: list[RouteTrack],
    inputs: PlanInputs,
    now_utc: datetime,
    get_forecasts: GetForecasts,
    fewer_routes: int | None = None,
) -> Plan:
    """Run the rules on the kept routes' tracks and give the Plan.

    The tracks must already be the bundle's simplified ones, so a plan and an update with the
    same settings give the same numbers. get_forecasts reads its own clock; now_utc is never
    passed to it.
    """
    if not 1 <= len(tracks) <= TOP_ROUTES:
        raise ValueError(f"a plan needs 1 to {TOP_ROUTES} routes, got {len(tracks)}")
    if len({t.order for t in tracks}) != len(tracks):
        raise ValueError("every route needs its own order")
    dep = inputs.departure_utc

    choice = interval_choice(tracks, inputs.interval, dep, now_utc, inputs.hos)
    placed = []
    for track in tracks:
        route_stops = stops(track.driving_s, inputs.hos)
        positions = place_checkpoints(track, choice.used_mi, dep, route_stops)
        placed.append(_Placed(track, route_stops, positions))

    checkpoint_keys = {
        _checkpoint_key(pos)
        for p in placed
        for pos in p.positions
        if in_window(forecast_hour(pos.eta_utc), now_utc)
    }
    grid = None
    if in_window(forecast_hour(dep), now_utc):
        cell_deg, ring = heatmap_grid(len(checkpoint_keys), tracks)
        cells = corridor(tracks, cell_deg, ring)
        grid = (cell_deg, cells)

    keys = set(checkpoint_keys)
    if grid is not None:
        keys |= {key_of(grid[0], i, j) for i, j in grid[1]}
    forecasts = get_forecasts(sorted(keys)) if keys else {}

    summaries = []
    checkpoints_by_order: dict[int, tuple[Checkpoint, ...]] = {}
    for p in placed:
        built = []
        rated = []
        for pos in p.positions:
            weather, rating = _rated(pos, now_utc, inputs.load_lb, forecasts)
            rated.append(RatedCheckpoint(pos.covered_mi, rating))
            built.append(
                Checkpoint(
                    n=pos.n,
                    mile=pos.mile,
                    of_mi=pos.of_mi,
                    lat=pos.lat,
                    lon=pos.lon,
                    covered_mi=pos.covered_mi,
                    eta_utc=pos.eta_utc,
                    tz=pos.tz,
                    forecast_utc=forecast_hour(pos.eta_utc),
                    weather=weather,
                    level=rating.level if rating else None,
                    causes=rating.causes if rating else (),
                    load_rule=rating.load_rule if rating else False,
                )
            )
        checkpoints_by_order[p.track.order] = tuple(built)
        travel_s = (p.positions[-1].eta_utc - dep).total_seconds()
        summaries.append(
            RouteSummary(p.track.source, p.track.order, route_numbers(rated), travel_s)
        )

    ranking = rank(summaries)
    placed_by_order = {p.track.order: p for p in placed}
    routes = []
    for ranked in ranking.routes:
        summary = ranked.route
        p = placed_by_order[summary.order]
        numbers = summary.numbers
        last = p.positions[-1]
        routes.append(
            Route(
                id=f"r{summary.order}",
                rank=ranked.rank,
                recommendation=ranked.recommendation,
                source=summary.source,
                distance_mi=p.track.length_mi,
                driving_s=p.track.driving_s,
                travel_s=summary.travel_s,
                arrival_utc=last.eta_utc,
                arrival_tz=last.tz,
                miles=numbers.miles_by_level,
                no_data_mi=numbers.no_data_mi,
                average_risk=numbers.average_risk,
                line=encode_polyline(list(p.track.points)),
                checkpoints=checkpoints_by_order[summary.order],
                truck=tuple(truck_positions(p.track, p.stops, dep)),
            )
        )

    heat = None
    if grid is not None:
        heat = heatmap(grid[1], forecasts, dep, now_utc, inputs.load_lb, grid[0])

    return Plan(
        now_utc=now_utc,
        window_end_utc=now_utc + timedelta(hours=FORECAST_WINDOW_H),
        trip=Trip(
            origin=inputs.origin,
            destination=inputs.destination,
            departure_utc=dep,
            load_lb=inputs.load_lb,
            load_value=inputs.load_value,
            load_unit=inputs.load_unit,
            hos=inputs.hos,
        ),
        interval=IntervalBlock(
            mode=IntervalMode.AUTO if inputs.interval == INTERVAL_AUTO else IntervalMode.FIXED,
            used_mi=choice.used_mi,
            requested_mi=choice.requested_mi,
            options=choice.options,
        ),
        notices=Notices(fewer_routes=fewer_routes, do_not_travel=ranking.do_not_travel),
        routes=tuple(routes),
        heatmap=heat,
    )
