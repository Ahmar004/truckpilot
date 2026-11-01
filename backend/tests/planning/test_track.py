import math

import pytest
from synthetic import straight_track

from core.constants import METERS_PER_MILE, RouteSource
from planning.geo import haversine_m
from planning.track import RouteTrack, simplify

P = ((38.0, -98.0), (38.0, -97.0), (38.0, -96.0))


def test_refuses_one_point():
    with pytest.raises(ValueError):
        RouteTrack(((38.0, -98.0),), (0.0,), (0.0,), RouteSource.API, 0)


def test_refuses_unequal_lengths():
    with pytest.raises(ValueError):
        RouteTrack(P, (0.0, 10.0), (0.0, 1.0, 2.0), RouteSource.API, 0)
    with pytest.raises(ValueError):
        RouteTrack(P, (0.0, 10.0, 20.0), (0.0, 1.0), RouteSource.API, 0)


def test_refuses_decreasing_dist():
    with pytest.raises(ValueError):
        RouteTrack(P, (0.0, 20.0, 10.0), (0.0, 1.0, 2.0), RouteSource.API, 0)


def test_refuses_decreasing_drive_s():
    with pytest.raises(ValueError):
        RouteTrack(P, (0.0, 10.0, 20.0), (0.0, 2.0, 1.0), RouteSource.API, 0)


def test_refuses_start_not_zero():
    with pytest.raises(ValueError):
        RouteTrack(P, (1.0, 10.0, 20.0), (0.0, 1.0, 2.0), RouteSource.API, 0)
    with pytest.raises(ValueError):
        RouteTrack(P, (0.0, 10.0, 20.0), (1.0, 2.0, 3.0), RouteSource.API, 0)


def test_refuses_zero_length():
    with pytest.raises(ValueError):
        RouteTrack(P[:2], (0.0, 0.0), (0.0, 0.0), RouteSource.API, 0)


def test_length_and_driving_properties():
    t = straight_track(10)
    assert t.length_mi == pytest.approx(10.0)
    assert t.driving_s == pytest.approx(600.0)


def test_at_distance_midpoint_and_clamp():
    t = RouteTrack(P, (0.0, 1000.0, 3000.0), (0.0, 100.0, 400.0), RouteSource.API, 0)
    assert t.at_distance(500.0) == pytest.approx((38.0, -97.5, 50.0))
    assert t.at_distance(2000.0) == pytest.approx((38.0, -96.5, 250.0))
    assert t.at_distance(-5.0) == pytest.approx((38.0, -98.0, 0.0))
    assert t.at_distance(99999.0) == pytest.approx((38.0, -96.0, 400.0))


def test_at_drive_s_midpoint_and_clamp():
    t = RouteTrack(P, (0.0, 1000.0, 3000.0), (0.0, 100.0, 400.0), RouteSource.API, 0)
    assert t.at_drive_s(50.0) == pytest.approx((38.0, -97.5, 500.0))
    assert t.at_drive_s(250.0) == pytest.approx((38.0, -96.5, 2000.0))
    assert t.at_drive_s(-1.0) == pytest.approx((38.0, -98.0, 0.0))
    assert t.at_drive_s(10_000.0) == pytest.approx((38.0, -96.0, 3000.0))


def test_at_drive_s_flat_stretch_returns_first_point():
    # drive_s is flat across the middle two points (a stretch with no driving time).
    pts = ((38.0, -98.0), (38.0, -97.0), (38.0, -96.0), (38.0, -95.0))
    t = RouteTrack(
        pts, (0.0, 1000.0, 2000.0, 3000.0), (0.0, 100.0, 100.0, 200.0), RouteSource.API, 0
    )
    assert t.at_drive_s(100.0) == pytest.approx((38.0, -97.0, 1000.0))


def test_simplify_keeps_length_and_driving_time():
    pts = [(38.5 + 0.0002 * math.sin(i / 2.0), -98.0 + i * 0.001) for i in range(300)]
    dist = [0.0]
    for p, q in zip(pts, pts[1:], strict=False):
        dist.append(dist[-1] + haversine_m(p[0], p[1], q[0], q[1]))
    drive = tuple(d / 26.8224 for d in dist)
    t = RouteTrack(tuple(pts), tuple(dist), drive, RouteSource.DETOUR, 2)
    s = simplify(t, 20.0)
    assert len(s.points) < len(t.points)
    assert s.points[0] == t.points[0]
    assert s.points[-1] == t.points[-1]
    assert s.length_mi == t.length_mi
    assert s.driving_s == t.driving_s
    assert s.source == RouteSource.DETOUR
    assert s.order == 2
    assert s.dist_m[-1] / METERS_PER_MILE == s.length_mi


@pytest.mark.parametrize("bad", [math.nan, math.inf])
def test_refuses_non_finite_values(bad):
    with pytest.raises(ValueError):
        RouteTrack(P, (0.0, 10.0, bad), (0.0, 1.0, 2.0), RouteSource.API, 0)
    with pytest.raises(ValueError):
        RouteTrack(P, (0.0, 10.0, 20.0), (0.0, 1.0, bad), RouteSource.API, 0)
    with pytest.raises(ValueError):
        RouteTrack(
            ((38.0, -98.0), (bad, -97.0), (38.0, -96.0)),
            (0.0, 10.0, 20.0),
            (0.0, 1.0, 2.0),
            RouteSource.API,
            0,
        )
    with pytest.raises(ValueError):
        RouteTrack(
            ((38.0, -98.0), (38.0, bad), (38.0, -96.0)),
            (0.0, 10.0, 20.0),
            (0.0, 1.0, 2.0),
            RouteSource.API,
            0,
        )
