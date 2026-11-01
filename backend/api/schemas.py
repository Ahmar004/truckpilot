"""The request and response shapes of the plan, update and place endpoints (architecture 4.1).

Requests are loose on purpose: a place token, a departure and a load are checked by hand in
`api.plans` so each failure gets its own error code. Responses are built by `plan_out` from the
`Plan` of the rules, with numbers as JSON numbers (a Decimal weather value goes out at its own
digits, so 0.1 stays 0.1) and times as UTC ISO 8601 with a "Z".
"""

from datetime import UTC, datetime

from ninja import Schema
from pydantic import StrictBool, StrictInt, StrictStr

from core.constants import (
    Cause,
    IntervalMode,
    Level,
    LoadUnit,
    Recommendation,
    RouteSource,
    TruckStatus,
)
from planning.heatmap import Heatmap
from planning.plan import Checkpoint, Plan, Route

# Decimal places kept on the wire. Miles are sent at 0.01 so the browser can show "under
# 0.1 mi"; a coordinate at 5 places is about a metre.
MILES_PLACES = 2
COORD_PLACES = 5


# Requests


class LoadIn(Schema):
    value: StrictInt
    unit: LoadUnit


class PlanRequest(Schema):
    origin: StrictStr
    destination: StrictStr
    departure_local: StrictStr
    load: LoadIn
    interval: StrictStr | StrictInt
    hos: StrictBool


class UpdateRequest(Schema):
    bundle: StrictStr
    interval: StrictStr | StrictInt
    hos: StrictBool


# Responses


class PlaceOut(Schema):
    label: str
    tz: str
    token: str


class PlacesOut(Schema):
    places: list[PlaceOut]


class PlaceRefOut(Schema):
    label: str
    tz: str


class LoadOut(Schema):
    value: int
    unit: LoadUnit


class TripOut(Schema):
    origin: PlaceRefOut
    destination: PlaceRefOut
    departure_utc: str
    load_lb: int
    load: LoadOut
    hos: bool


class IntervalOptionOut(Schema):
    mi: int
    allowed: bool


class IntervalOut(Schema):
    mode: IntervalMode
    used_mi: int
    requested_mi: int | None
    options: list[IntervalOptionOut]


class NoticesOut(Schema):
    fewer_routes: int | None
    do_not_travel: bool


class MilesOut(Schema):
    low: float
    moderate: float
    high: float
    severe: float
    no_travel: float
    no_data: float


class WeatherOut(Schema):
    wind_mph: float
    rain_in: float
    snow_in: float


class CheckpointOut(Schema):
    n: int
    mile: int
    of_mi: int
    lat: float
    lon: float
    covered_mi: float
    eta_utc: str
    tz: str
    forecast_utc: str
    weather: WeatherOut | None
    level: str | None
    causes: list[Cause]
    load_rule: bool


class TruckOut(Schema):
    lat: float
    lon: float
    mile: float
    status: TruckStatus


class RouteOut(Schema):
    id: str
    rank: int
    recommendation: Recommendation | None
    source: RouteSource
    distance_mi: float
    driving_s: int
    travel_s: int
    arrival_utc: str
    arrival_tz: str
    miles: MilesOut
    average_risk: float | None
    line: str
    checkpoints: list[CheckpointOut]
    truck: list[TruckOut]


class HeatmapHourOut(Schema):
    utc: str
    in_window: bool


class HeatmapCellOut(Schema):
    i: int
    j: int
    lv: str
    cz: list[int]


class HeatmapOut(Schema):
    cell_deg: float
    hours: list[HeatmapHourOut]
    cells: list[HeatmapCellOut]


class PlanOut(Schema):
    now_utc: str
    window_end_utc: str
    trip: TripOut
    interval: IntervalOut
    notices: NoticesOut
    routes: list[RouteOut]
    heatmap: HeatmapOut | None
    bundle: str


# Building the answer


def utc_text(moment: datetime) -> str:
    """A UTC ISO 8601 time to the second, ending in Z."""
    return moment.astimezone(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def _checkpoint(cp: Checkpoint) -> dict:
    weather = cp.weather
    return {
        "n": cp.n,
        "mile": cp.mile,
        "of_mi": cp.of_mi,
        "lat": round(cp.lat, COORD_PLACES),
        "lon": round(cp.lon, COORD_PLACES),
        "covered_mi": round(cp.covered_mi, MILES_PLACES),
        "eta_utc": utc_text(cp.eta_utc),
        "tz": cp.tz,
        "forecast_utc": utc_text(cp.forecast_utc),
        "weather": None
        if weather is None
        else {
            "wind_mph": float(weather.wind_mph),
            "rain_in": float(weather.rain_in),
            "snow_in": float(weather.snow_in),
        },
        "level": None if cp.level is None else cp.level.code,
        "causes": list(cp.causes),
        "load_rule": cp.load_rule,
    }


def _route(route: Route) -> dict:
    miles = {level.code: round(route.miles.get(level, 0.0), MILES_PLACES) for level in Level}
    miles["no_data"] = round(route.no_data_mi, MILES_PLACES)
    return {
        "id": route.id,
        "rank": route.rank,
        "recommendation": route.recommendation,
        "source": route.source,
        "distance_mi": round(route.distance_mi, MILES_PLACES),
        "driving_s": round(route.driving_s),
        "travel_s": round(route.travel_s),
        "arrival_utc": utc_text(route.arrival_utc),
        "arrival_tz": route.arrival_tz,
        "miles": miles,
        "average_risk": None if route.average_risk is None else float(route.average_risk),
        "line": route.line,
        "checkpoints": [_checkpoint(cp) for cp in route.checkpoints],
        "truck": [
            {
                "lat": round(t.lat, COORD_PLACES),
                "lon": round(t.lon, COORD_PLACES),
                "mile": round(t.mile, MILES_PLACES),
                "status": t.status,
            }
            for t in route.truck
        ],
    }


def _heatmap(heat: Heatmap) -> dict:
    return {
        "cell_deg": float(heat.cell_deg),
        "hours": [{"utc": utc_text(h.utc), "in_window": h.in_window} for h in heat.hours],
        "cells": [{"i": c.i, "j": c.j, "lv": c.lv, "cz": list(c.cz)} for c in heat.cells],
    }


def plan_out(plan: Plan, bundle: str) -> dict:
    """The answer for a Plan and the signed bundle that goes with it."""
    trip = plan.trip
    interval = plan.interval
    return {
        "now_utc": utc_text(plan.now_utc),
        "window_end_utc": utc_text(plan.window_end_utc),
        "trip": {
            "origin": {"label": trip.origin.label, "tz": trip.origin.tz},
            "destination": {"label": trip.destination.label, "tz": trip.destination.tz},
            "departure_utc": utc_text(trip.departure_utc),
            "load_lb": trip.load_lb,
            "load": {"value": trip.load_value, "unit": trip.load_unit},
            "hos": trip.hos,
        },
        "interval": {
            "mode": interval.mode,
            "used_mi": interval.used_mi,
            "requested_mi": interval.requested_mi,
            "options": [{"mi": o.mi, "allowed": o.allowed} for o in interval.options],
        },
        "notices": {
            "fewer_routes": plan.notices.fewer_routes,
            "do_not_travel": plan.notices.do_not_travel,
        },
        "routes": [_route(r) for r in plan.routes],
        "heatmap": None if plan.heatmap is None else _heatmap(plan.heatmap),
        "bundle": bundle,
    }
