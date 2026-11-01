import dataclasses
import math
import time

import pytest
from synthetic import line_track, track_through

from core.constants import (
    DETOUR_OFFSETS,
    METERS_PER_MILE,
    US_CANADA_ZONES,
    RouteSource,
)
from planning import detours
from planning.geo import haversine_m
from planning.zones import zone_at

# A flat frame in kilometres around one point in Kansas: east and north to (lat, lon).
BASE_LAT, BASE_LON = 38.5, -98.0
KM_PER_DEG_LAT = math.pi / 180 * 6371.0088


def at(east_km: float, north_km: float) -> tuple[float, float]:
    lat = BASE_LAT + north_km / KM_PER_DEG_LAT
    lon = BASE_LON + east_km / (KM_PER_DEG_LAT * math.cos(math.radians(BASE_LAT)))
    return lat, lon


def path(corners: list[tuple[float, float]], step_m: float = 100.0):
    """Points every step_m along straight legs between corners given in km."""
    pts = [at(*corners[0])]
    for (e0, n0), (e1, n1) in zip(corners, corners[1:], strict=False):
        legs = max(1, round(math.hypot(e1 - e0, n1 - n0) * 1000 / step_m))
        pts.extend(
            at(e0 + (e1 - e0) * i / legs, n0 + (n1 - n0) * i / legs) for i in range(1, legs + 1)
        )
    return pts


def bearing(a, b) -> float:
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dl = math.radians(b[1] - a[1])
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return math.degrees(math.atan2(y, x)) % 360


def angle_between(a: float, b: float) -> float:
    return abs((a - b + 180) % 360 - 180)


# --- waypoints -------------------------------------------------------------------------


@pytest.mark.parametrize(
    "origin,destination",
    [
        ((39.0, -100.5), (39.0, -94.5)),  # east
        ((36.0, -98.0), (42.0, -98.0)),  # north
        ((37.0, -101.0), (41.0, -96.0)),  # north-east
    ],
)
def test_waypoints_sit_at_15_and_30_percent_on_both_sides_at_right_angles(origin, destination):
    fastest = line_track(origin, destination)
    mid = fastest.at_distance(fastest.dist_m[-1] / 2)[:2]
    trip = haversine_m(*origin, *destination)
    heading = bearing(origin, destination)

    points = detours.waypoints(fastest, origin, destination)

    assert len(points) == 4
    left15, right15, left30, right30 = points
    for point, share in zip(points, (0.15, 0.15, 0.30, 0.30), strict=True):
        assert haversine_m(*mid, *point) == pytest.approx(share * trip, rel=0.01)
    assert DETOUR_OFFSETS == (0.15, 0.30)
    for point in (left15, left30):
        assert angle_between(bearing(mid, point), heading - 90) < 1
    for point in (right15, right30):
        assert angle_between(bearing(mid, point), heading + 90) < 1


def test_the_halfway_point_is_halfway_along_the_fastest_route_not_the_straight_line():
    bent = track_through(path([(0, 0), (100, 60), (200, 0)]))
    origin, destination = bent.points[0], bent.points[-1]
    mid = bent.at_distance(bent.dist_m[-1] / 2)[:2]
    points = detours.waypoints(bent, origin, destination)
    trip = haversine_m(*origin, *destination)
    assert len(points) == 4
    for point, share in zip(points, (0.15, 0.15, 0.30, 0.30), strict=True):
        assert haversine_m(*mid, *point) == pytest.approx(share * trip, rel=0.01)


def test_waypoints_in_the_gulf_of_mexico_are_dropped():
    houston, new_orleans = (29.76, -95.37), (29.95, -90.07)
    fastest = line_track(houston, new_orleans)
    points = detours.waypoints(fastest, houston, new_orleans)
    mid_lat = fastest.at_distance(fastest.dist_m[-1] / 2)[0]
    # Left of an eastward trip is north (land); right is south (the Gulf).
    assert len(points) == 2
    assert all(lat > mid_lat for lat, _ in points)
    assert all(zone_at(*p) in US_CANADA_ZONES for p in points)


def test_waypoints_in_mexico_are_dropped():
    # Along the Rio Grande the south side is Mexico.
    laredo, mcallen = (27.5, -99.5), (26.2, -98.2)
    fastest = line_track(laredo, mcallen)
    points = detours.waypoints(fastest, laredo, mcallen)
    assert len(points) < 4
    assert all(zone_at(*p) in US_CANADA_ZONES for p in points)


@pytest.mark.parametrize(
    "point", [(45.5, -73.6), (48.4, -89.3), (53.5, -113.5), (49.9, -97.1), (46.5, -84.3)]
)
def test_zones_timezonefinder_gives_in_canada_and_the_us_are_on_the_list(point):
    assert zone_at(*point) in US_CANADA_ZONES


# --- backtracks ------------------------------------------------------------------------


def test_a_straight_track_does_not_backtrack():
    assert detours.backtracks(track_through(path([(0, 0), (30, 0)]))) is False


def test_a_spur_of_2_km_out_and_back_backtracks():
    spur = track_through(path([(0, 0), (10, 0), (10, 2), (10, 0), (20, 0)]))
    assert detours.backtracks(spur) is True


def test_a_300_m_perpendicular_crossing_of_its_own_path_does_not_backtrack():
    loop = track_through(path([(0, 0), (5, 0), (5, 1), (3, 1), (3, -1), (8, -1)]))
    assert detours.backtracks(loop) is False


def test_riding_300_m_over_its_own_earlier_path_does_not_backtrack():
    # Driving on from (2, 0) to (2.3, 0) rides over the earlier east-bound road.
    merge = track_through(path([(0, 0), (5, 0), (5, 2), (2, 2), (2, 0), (2.3, 0), (2.3, -3)]))
    assert detours.backtracks(merge) is False


def test_a_long_drive_back_over_the_same_road_backtracks():
    side_by_side = track_through(path([(0, 0), (10, 0), (10, 0.5), (0, 0.5)]))
    assert detours.backtracks(side_by_side) is False  # 500 m apart: not the same road
    same_road = track_through(path([(0, 0), (10, 0), (10, 0.01), (0, 0.01)]))
    assert detours.backtracks(same_road) is True


# --- shared_share ----------------------------------------------------------------------


def test_the_share_of_an_identical_route_is_1():
    kept = track_through(path([(0, 0), (40, 0)], step_m=150))
    assert detours.shared_share(kept, [kept]) == 1.0


def test_the_share_of_a_disjoint_parallel_route_is_0():
    kept = track_through(path([(0, 0), (40, 0)]))
    far = track_through(path([(0, 5), (40, 5)]))
    assert detours.shared_share(far, [kept]) == 0.0


def test_a_candidate_that_shares_half_its_length_has_a_share_of_about_half():
    kept = track_through(path([(0, 0), (40, 0)], step_m=1500))
    half = track_through(path([(0, 0), (20, 0), (20, 20)]))
    # 20 km along kept, then 20 km straight away from it.
    assert detours.shared_share(half, [kept]) == pytest.approx(0.5, abs=0.02)


def test_the_share_is_against_the_road_between_points_not_only_the_points():
    kept = track_through(path([(0, 0), (40, 0)], step_m=10_000))
    dense = track_through(path([(0, 0), (40, 0)], step_m=100))
    assert detours.shared_share(dense, [kept]) == 1.0


@pytest.mark.parametrize("offset_m,expected", [(10, 1.0), (22, 1.0), (30, 0.0), (60, 0.0)])
def test_the_match_distance_is_25_m(offset_m, expected):
    kept = track_through(path([(0, 0), (20, 0)]))
    near = track_through(path([(0, offset_m / 1000), (20, offset_m / 1000)]))
    assert detours.shared_share(near, [kept]) == expected


def test_the_share_counts_every_kept_route_and_no_kept_routes_is_0():
    a = track_through(path([(0, 0), (20, 0)]))
    b = track_through(path([(0, 5), (20, 5)]))
    both = track_through(path([(0, 0), (10, 0), (10, 5), (20, 5)]))
    assert detours.shared_share(both, [a]) < detours.shared_share(both, [a, b])
    assert detours.shared_share(both, []) == 0.0


# --- apply_ladder ----------------------------------------------------------------------

LENGTH_KM = 160.0


def api_route(order: int = 0, north_km: float = 0.0, time_factor: float = 1.0):
    return track_through(
        path([(0, north_km), (LENGTH_KM, north_km)], step_m=500), time_factor, order=order
    )


# The driving time of the API route; detours are timed as a multiple of it, exactly.
BASE_S = api_route().driving_s


def timed(track, time_factor: float):
    """The track with its driving time set to time_factor times BASE_S."""
    target = time_factor * BASE_S
    drive = tuple(d / track.dist_m[-1] * target for d in track.dist_m)
    return dataclasses.replace(track, drive_s=drive)


def detour(shared_fraction: float, time_factor: float, side: int = 1, bend: float = 1.0):
    """Runs along the API route for shared_fraction of its own length LENGTH_KM, then leaves it
    for the rest, to the north (side 1) or south (side -1), at a slope of `bend` (north per
    east). It does not need to end at the destination."""
    shared_km = shared_fraction * LENGTH_KM
    away_km = (1 - shared_fraction) * LENGTH_KM
    theta = math.atan(bend)
    corners = [(0, 0), (shared_km, 0)]
    if away_km > 0:
        corners.append((shared_km + away_km * math.cos(theta), side * away_km * math.sin(theta)))
    return timed(track_through(path(corners), 1.0, RouteSource.DETOUR), time_factor)


def test_the_candidate_scenarios_have_the_shares_the_tests_assume():
    api = api_route()
    assert 0.35 < detours.shared_share(detour(0.4, 1.3), [api]) < 0.45


def test_a_130_percent_candidate_with_40_percent_shared_is_refused_at_step_1_and_kept_at_step_2():
    api = api_route()
    slow = detour(0.4, 1.3)
    fast_distinct = detour(0.0, 1.2, side=-1)
    # Step 1 keeps only the 120% candidate; the 130% one waits for step 2.
    assert detours.apply_ladder([api], [slow, fast_distinct]) == [api, fast_distinct, slow]
    # Alone, the 130% candidate is still kept (at step 2).
    assert detours.apply_ladder([api], [slow]) == [api, slow]


@pytest.mark.parametrize(
    "shared_fraction,time_factor,kept",
    [
        (0.0, 1.25, True),  # exactly at the step 1 time limit
        (0.0, 1.26, True),  # step 2
        (0.0, 1.50, True),  # exactly at the step 2 time limit
        (0.0, 1.51, True),  # step 3
        (0.0, 2.00, True),  # exactly at the step 3 time limit
        (0.0, 2.01, False),  # over every time limit
        (0.6, 1.1, True),  # too much shared road for step 1, fine at step 2
        (0.8, 1.1, True),  # too much for step 2, fine at step 3
        (0.97, 1.1, False),  # more than step 3 allows
    ],
)
def test_the_ladder_limits(shared_fraction, time_factor, kept):
    api = api_route()
    candidate = detour(shared_fraction, time_factor)
    result = detours.apply_ladder([api], [candidate])
    assert (len(result) == 2) is kept


def test_two_near_identical_detours_are_not_both_kept():
    api = api_route()
    first = detour(0.0, 1.1)
    second = timed(track_through([(lat + 0.00005, lon) for lat, lon in first.points]), 1.2)
    assert detours.apply_ladder([api], [first, second]) == [api, first]


def test_fewer_than_3_after_step_3_gives_fewer_tracks():
    api = api_route()
    result = detours.apply_ladder([api], [detour(0.0, 2.5), detour(0.97, 1.1)])
    assert result == [api]


def test_a_candidate_that_backtracks_is_never_kept():
    api = api_route()
    spur = timed(
        track_through(path([(0, 0), (80, 0), (80, 10), (80, 0.01), (LENGTH_KM, 0.5)])), 1.1
    )
    assert detours.backtracks(spur)
    assert detours.apply_ladder([api], [spur]) == [api]


def test_an_exact_repeat_of_a_candidate_is_ignored_and_not_tested_again(monkeypatch):
    api = api_route()
    spur = timed(
        track_through(path([(0, 0), (80, 0), (80, 10), (80, 0.01), (LENGTH_KM, 0.5)])), 1.1
    )
    calls = []
    real = detours._backtracks
    monkeypatch.setattr(detours, "_backtracks", lambda line: calls.append(1) or real(line))
    assert detours.apply_ladder([api], [spur, spur, spur]) == [api]
    assert len(calls) == 1


def test_the_candidate_with_the_shortest_driving_time_is_kept_first():
    api = api_route()
    north = detour(0.0, 1.2)
    south = detour(0.0, 1.1, side=-1)
    assert detours.apply_ladder([api], [north, south]) == [api, south, north]


def test_a_tie_in_driving_time_keeps_the_earlier_candidate():
    api = api_route()
    first = detour(0.0, 1.2)
    second = detour(0.0, 1.2, side=-1)
    assert detours.apply_ladder([api], [first, second])[1] is first
    assert detours.apply_ladder([api], [second, first])[1] is second


def test_it_stops_at_three_routes():
    api = api_route()
    candidates = [detour(0.0, 1.1 + i * 0.01, bend=0.5 + i * 0.3) for i in range(5)]
    result = detours.apply_ladder([api], candidates)
    assert len(result) == 3
    assert result[1:] == candidates[:2]


def test_api_routes_come_first_in_their_given_order():
    slow_first = api_route(order=0, time_factor=1.3)
    fast_second = api_route(order=1, north_km=1.0)
    result = detours.apply_ladder([slow_first, fast_second], [detour(0.0, 1.1, side=-1)])
    assert result[:2] == [slow_first, fast_second]
    assert len(result) == 3


def test_three_api_routes_need_no_detour():
    routes = [api_route(0, 0, 1.3), api_route(1, 1.0), api_route(2, 2.0, 1.4)]
    assert detours.apply_ladder(routes, [detour(0.0, 1.1)]) == routes


def test_the_base_is_the_fastest_api_route_not_the_first():
    slow_first = api_route(order=0, time_factor=1.3)
    fast_second = api_route(order=1, north_km=1.0)
    # 1.6 x the fastest is step 3; 2.1 x is over every limit.
    kept = detour(0.0, 1.6, side=-1)
    assert detours.apply_ladder([slow_first, fast_second], [kept])[-1] is kept
    too_slow = detour(0.0, 2.1, side=-1)
    assert detours.apply_ladder([slow_first, fast_second], [too_slow]) == [slow_first, fast_second]


def test_the_share_is_checked_against_detours_already_kept_as_well_as_api_routes():
    api = api_route()
    first = detour(0.0, 1.1)
    # Rides on the road of `first` (a detour, not an API route) for most of its length.
    # About 11 m away from the road of `first`.
    shifted = timed(track_through([(lat + 0.0001, lon) for lat, lon in first.points]), 1.2)
    assert detours.shared_share(shifted, [api]) < 0.1
    assert detours.shared_share(shifted, [api, first]) > 0.9
    assert detours.apply_ladder([api], [first, shifted]) == [api, first]


# --- speed -----------------------------------------------------------------------------


def big_route(amplitude_km: float, phase: float, time_factor: float):
    """A 1,500 mi route with a point about every 150 m, bulging north and south."""
    total_m = 1500 * METERS_PER_MILE
    n = round(total_m / 150)
    start, end = (41.88, -87.63), (34.05, -118.24)
    points = []
    for i in range(n + 1):
        t = i / n
        bulge = amplitude_km / KM_PER_DEG_LAT * math.sin(math.pi * t) * math.sin(phase + 6 * t)
        points.append(
            (start[0] + (end[0] - start[0]) * t + bulge, start[1] + (end[1] - start[1]) * t)
        )
    return track_through(points, time_factor, RouteSource.DETOUR)


def test_ladder_speed():
    api = big_route(0, 0, 1.0)
    candidates = [big_route(30 + 25 * i, i, 1.05 + 0.1 * i) for i in range(8)]
    began = time.perf_counter()
    result = detours.apply_ladder([api], candidates)
    elapsed = time.perf_counter() - began
    print(f"ladder with 8 candidates on 1,500 mi: {elapsed:.3f} s, kept {len(result)}")
    assert len(result) == 3
    assert elapsed < 0.5


def test_ladder_speed_when_most_candidates_share_the_road():
    """Real detours often ride the main road for most of their length, so most candidates are
    refused by the share test and every one of them is sampled and compared."""
    api = big_route(0, 0, 1.0)
    shared = [
        track_through([(lat + 0.0001 * (i + 1), lon) for lat, lon in api.points], 1.1 + 0.01 * i)
        for i in range(6)
    ]
    shared = [dataclasses.replace(t, source=RouteSource.DETOUR) for t in shared]
    candidates = shared + [big_route(40, 1, 1.3), big_route(80, 2, 1.4)]
    began = time.perf_counter()
    result = detours.apply_ladder([api], candidates)
    elapsed = time.perf_counter() - began
    print(f"ladder with 6 near-copies and 2 distinct on 1,500 mi: {elapsed:.3f} s")
    assert len(result) == 3
    assert elapsed < 1.5
