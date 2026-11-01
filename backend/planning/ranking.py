"""Route numbers, ranking and the recommendation (spec 9.2-9.4).

Pure business rules. The plan builder rates each Checkpoint with risk.rate() and passes the
rated Checkpoints here.
"""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from core.constants import (
    AVERAGE_RISK_PRECISION,
    MILES_COMPARE_PRECISION,
    SECONDS_PER_MINUTE,
    TOP_ROUTES,
    TRAVEL_MINUTE_PRECISION,
    Level,
    Recommendation,
    RouteSource,
)
from planning.risk import Rating


@dataclass(frozen=True)
class RatedCheckpoint:
    """A Checkpoint's covered miles and its rating; rating None means No weather data."""

    covered_mi: float
    rating: Rating | None


@dataclass(frozen=True)
class RouteNumbers:
    miles_by_level: dict[Level, float]
    no_data_mi: float
    average_risk: Decimal | None
    has_no_travel: bool


@dataclass(frozen=True)
class RouteSummary:
    source: RouteSource
    order: int
    numbers: RouteNumbers
    travel_s: float


@dataclass(frozen=True)
class RankedRoute:
    rank: int
    recommendation: Recommendation | None
    route: RouteSummary


@dataclass(frozen=True)
class Ranking:
    routes: list[RankedRoute]
    do_not_travel: bool


def _round(value: float | Decimal, precision: Decimal) -> Decimal:
    """Round half up. Goes through str() so float noise never moves a value across a tie."""
    return Decimal(str(value)).quantize(precision, rounding=ROUND_HALF_UP)


def route_numbers(checkpoints: list[RatedCheckpoint]) -> RouteNumbers:
    miles_by_level = {level: 0.0 for level in Level}
    no_data_mi = 0.0
    weighted = Decimal(0)
    with_data = Decimal(0)
    has_no_travel = False
    for cp in checkpoints:
        if cp.rating is None:
            no_data_mi += cp.covered_mi
            continue
        level = cp.rating.level
        miles_by_level[level] += cp.covered_mi
        covered = Decimal(str(cp.covered_mi))
        weighted += int(level) * covered
        with_data += covered
        if level == Level.NO_TRAVEL:
            has_no_travel = True
    average_risk = _round(weighted / with_data, AVERAGE_RISK_PRECISION) if with_data else None
    return RouteNumbers(miles_by_level, no_data_mi, average_risk, has_no_travel)


def _sort_key(route: RouteSummary) -> tuple:
    numbers = route.numbers
    miles = numbers.miles_by_level
    average = numbers.average_risk if numbers.average_risk is not None else Decimal(0)
    no_travel_mi = (
        _round(miles[Level.NO_TRAVEL], MILES_COMPARE_PRECISION)
        if numbers.has_no_travel
        else Decimal(0)
    )
    return (
        numbers.has_no_travel,
        no_travel_mi,
        _round(miles[Level.SEVERE], MILES_COMPARE_PRECISION),
        _round(miles[Level.HIGH], MILES_COMPARE_PRECISION),
        average,
        _round(route.travel_s / SECONDS_PER_MINUTE, TRAVEL_MINUTE_PRECISION),
        0 if route.source == RouteSource.API else 1,
        route.order,
    )


def rank(routes: list[RouteSummary]) -> Ranking:
    """Order Routes best first, keep the top TOP_ROUTES and mark the recommended one (spec 9.4)."""
    kept = sorted(routes, key=_sort_key)[:TOP_ROUTES]
    ranked: list[RankedRoute] = []
    recommended_given = False
    for position, route in enumerate(kept, start=1):
        if route.numbers.has_no_travel:
            recommendation = Recommendation.NOT_RECOMMENDED
        elif not recommended_given:
            recommendation = Recommendation.RECOMMENDED
            recommended_given = True
        else:
            recommendation = None
        ranked.append(RankedRoute(position, recommendation, route))
    do_not_travel = bool(kept) and all(r.route.numbers.has_no_travel for r in ranked)
    return Ranking(ranked, do_not_travel)
