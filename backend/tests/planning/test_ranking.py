from decimal import Decimal

from core.constants import Cause, Level, Recommendation, RouteSource
from planning.ranking import RatedCheckpoint, RouteSummary, rank, route_numbers
from planning.risk import Rating


def _rating(level: Level) -> Rating:
    return Rating(level, (Cause.WIND,), True)


def _cps(spec: list[tuple[float, Level | None]]) -> list[RatedCheckpoint]:
    return [RatedCheckpoint(mi, None if lvl is None else _rating(lvl)) for mi, lvl in spec]


def _route(
    spec: list[tuple[float, Level | None]],
    travel_s: float = 3600,
    source: RouteSource = RouteSource.API,
    order: int = 0,
) -> RouteSummary:
    return RouteSummary(source, order, route_numbers(_cps(spec)), travel_s)


def _orders(ranking) -> list[int]:
    return [r.route.order for r in ranking.routes]


def test_route_numbers_spec_example_route_a():
    n = route_numbers(
        _cps(
            [
                (12.5, Level.LOW),
                (25, Level.SEVERE),
                (25, Level.HIGH),
                (25, Level.MODERATE),
                (12.5, Level.LOW),
            ]
        )
    )
    assert n.average_risk == Decimal("1.50")
    assert n.miles_by_level[Level.SEVERE] == 25
    assert n.miles_by_level[Level.HIGH] == 25
    assert n.miles_by_level[Level.NO_TRAVEL] == 0
    assert n.has_no_travel is False
    assert set(n.miles_by_level) == set(Level)


def test_route_numbers_no_data_left_out_of_average():
    n = route_numbers(_cps([(25, Level.HIGH), (25, None)]))
    assert n.average_risk == Decimal("2.00")
    assert n.no_data_mi == 25
    assert sum(n.miles_by_level.values()) == 25


def test_route_numbers_all_no_data():
    n = route_numbers(_cps([(25, None), (10, None)]))
    assert n.average_risk is None
    assert n.has_no_travel is False
    assert n.no_data_mi == 35


def test_route_numbers_average_rounds_half_up():
    # 1 / 8 = 0.125 exactly, so half up gives 0.13 (banker's rounding would give 0.12).
    n = route_numbers(_cps([(1, Level.MODERATE), (7, Level.LOW)]))
    assert n.average_risk == Decimal("0.13")


def test_spec_13_example_order_b_a_c():
    a = _route(
        [
            (12.5, Level.LOW),
            (25, Level.SEVERE),
            (25, Level.HIGH),
            (25, Level.MODERATE),
            (12.5, Level.LOW),
        ],
        order=0,
    )
    b = _route([(50, Level.HIGH), (60, Level.LOW)], order=1)
    c = _route([(12.5, Level.NO_TRAVEL), (87.5, Level.LOW)], order=2)
    ranking = rank([a, b, c])
    assert _orders(ranking) == [1, 0, 2]
    assert [r.rank for r in ranking.routes] == [1, 2, 3]
    assert [r.recommendation for r in ranking.routes] == [
        Recommendation.RECOMMENDED,
        None,
        Recommendation.NOT_RECOMMENDED,
    ]
    assert ranking.do_not_travel is False


def test_no_travel_route_ranks_after_routes_without():
    clean = _route([(100, Level.SEVERE)], travel_s=9000, order=0)
    nt = _route([(1, Level.NO_TRAVEL), (99, Level.LOW)], travel_s=1000, order=1)
    ranking = rank([nt, clean])
    assert _orders(ranking) == [0, 1]


def test_two_no_travel_routes_fewer_no_travel_miles_first():
    more = _route([(30, Level.NO_TRAVEL), (70, Level.LOW)], order=0)
    fewer = _route([(10, Level.NO_TRAVEL), (90, Level.SEVERE)], order=1)
    ranking = rank([more, fewer])
    assert _orders(ranking) == [1, 0]


def test_tiny_no_travel_checkpoint_still_counts():
    tiny = _route([(0.02, Level.NO_TRAVEL), (99.98, Level.LOW)], order=0)
    assert tiny.numbers.has_no_travel is True
    severe = _route([(50, Level.SEVERE), (50, Level.LOW)], order=1)
    ranking = rank([tiny, severe])
    assert _orders(ranking) == [1, 0]
    assert ranking.routes[0].recommendation == Recommendation.RECOMMENDED
    assert ranking.routes[1].recommendation == Recommendation.NOT_RECOMMENDED


def test_rounding_before_comparing_miles():
    x = _route([(12.54, Level.SEVERE), (5, Level.HIGH)], order=0)
    y = _route([(12.46, Level.SEVERE), (10, Level.HIGH)], order=1)
    ranking = rank([y, x])
    assert _orders(ranking) == [0, 1]


def test_travel_time_rounds_to_minute():
    slow = _route([(10, Level.LOW)], travel_s=3629, order=0)
    fast = _route([(10, Level.LOW)], travel_s=3601, order=1)
    # Both are 60 min, so order decides, not the raw seconds: slow (order 0) ranks first.
    assert _orders(rank([fast, slow])) == [0, 1]


def test_travel_time_decides_when_minutes_differ():
    slow = _route([(10, Level.LOW)], travel_s=3720, order=0)
    fast = _route([(10, Level.LOW)], travel_s=3600, order=1)
    assert _orders(rank([slow, fast])) == [1, 0]


def test_full_tie_api_before_detour():
    detour = _route([(10, Level.LOW)], source=RouteSource.DETOUR, order=0)
    api = _route([(10, Level.LOW)], source=RouteSource.API, order=1)
    ranking = rank([detour, api])
    assert ranking.routes[0].route.source == RouteSource.API


def test_all_kept_routes_no_travel_means_do_not_travel():
    routes = [
        _route([(10, Level.NO_TRAVEL), (90, Level.LOW)], order=0),
        _route([(20, Level.NO_TRAVEL), (80, Level.LOW)], order=1),
    ]
    ranking = rank(routes)
    assert ranking.do_not_travel is True
    assert all(r.recommendation == Recommendation.NOT_RECOMMENDED for r in ranking.routes)


def test_only_top_three_kept():
    routes = [_route([(10, Level.LOW)], travel_s=3600 + 600 * i, order=i) for i in range(4)]
    ranking = rank(routes)
    assert len(ranking.routes) == 3
    assert [r.rank for r in ranking.routes] == [1, 2, 3]
    assert _orders(ranking) == [0, 1, 2]


def test_empty_input():
    ranking = rank([])
    assert ranking.routes == []
    assert ranking.do_not_travel is False


def test_rank_all_no_data():
    routes = [
        _route([(50, None), (50, None)], travel_s=7200, order=0),
        _route([(50, None)], travel_s=3600, order=1),
        _route([(50, None)], travel_s=5400, order=2),
    ]
    ranking = rank(routes)
    assert all(r.route.numbers.average_risk is None for r in ranking.routes)
    assert all(r.route.numbers.has_no_travel is False for r in ranking.routes)
    assert _orders(ranking) == [1, 2, 0]
    assert ranking.routes[0].recommendation == Recommendation.RECOMMENDED
    assert ranking.do_not_travel is False
