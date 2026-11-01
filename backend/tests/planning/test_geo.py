import math

import pytest

from planning.geo import decode_polyline, douglas_peucker, encode_polyline, haversine_m

CHICAGO = (41.8781, -87.6298)
DALLAS = (32.7767, -96.7970)


def test_haversine_chicago_dallas():
    d = haversine_m(*CHICAGO, *DALLAS)
    assert abs(d - 1_290_000) / 1_290_000 < 0.01


def test_haversine_same_point_is_zero():
    assert haversine_m(10.0, 20.0, 10.0, 20.0) == 0.0


def _wiggly():
    # A west-east line with north-south wiggles of up to about 50 m.
    pts = []
    for i in range(400):
        lon = -98.0 + i * 0.0005
        lat = 38.5 + 0.00045 * math.sin(i / 3.0) + (0.0002 if i % 7 == 0 else 0.0)
        pts.append((lat, lon))
    return pts


def _dist_to_segment_m(p, a, b):
    lat0 = math.radians(a[0])
    k = 111_194.9266

    def xy(q):
        return ((q[1] - a[1]) * math.cos(lat0) * k, (q[0] - a[0]) * k)

    px, py = xy(p)
    bx, by = xy(b)
    seg2 = bx * bx + by * by
    t = 0.0 if seg2 == 0 else max(0.0, min(1.0, (px * bx + py * by) / seg2))
    return math.hypot(px - t * bx, py - t * by)


def test_simplify_keeps_ends_and_dropped_points_within_tolerance():
    pts = _wiggly()
    tol = 20.0
    kept = douglas_peucker(pts, tol)
    assert kept[0] == 0
    assert kept[-1] == len(pts) - 1
    assert kept == sorted(kept)
    assert len(kept) < len(pts)
    for a, b in zip(kept, kept[1:], strict=False):
        for i in range(a + 1, b):
            assert _dist_to_segment_m(pts[i], pts[a], pts[b]) <= tol * 1.01


def test_simplify_two_points_keeps_both():
    assert douglas_peucker([(1.0, 1.0), (2.0, 2.0)], 20.0) == [0, 1]


def test_simplify_straight_line_drops_middle():
    pts = [(38.5, -98.0 + i * 0.01) for i in range(10)]
    assert douglas_peucker(pts, 20.0) == [0, 9]


def test_polyline_google_reference_example():
    pts = [(38.5, -120.2), (40.7, -120.95), (43.252, -126.453)]
    assert encode_polyline(pts) == "_p~iF~ps|U_ulLnnqC_mqNvxq`@"
    back = decode_polyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")
    for (la, lo), (lb, lob) in zip(pts, back, strict=True):
        assert abs(la - lb) <= 1e-9
        assert abs(lo - lob) <= 1e-9


def test_polyline_round_trip_precision_5():
    pts = _wiggly()
    back = decode_polyline(encode_polyline(pts))
    assert len(back) == len(pts)
    for (la, lo), (lb, lob) in zip(pts, back, strict=True):
        assert abs(la - lb) <= 1e-5
        assert abs(lo - lob) <= 1e-5


def test_polyline_precision_6_round_trip():
    pts = [(38.123456, -120.654321), (40.000001, -100.999999)]
    back = decode_polyline(encode_polyline(pts, precision=6), precision=6)
    for (la, lo), (lb, lob) in zip(pts, back, strict=True):
        assert abs(la - lb) <= 1e-6
        assert abs(lo - lob) <= 1e-6


@pytest.mark.parametrize("bad", ["_p~iF~ps|U_", "_", "~", "_p~iF~ps|U_ulLnnqC_mqN"])
def test_decode_polyline_refuses_truncated_input(bad):
    with pytest.raises(ValueError):
        decode_polyline(bad)


def test_decode_polyline_refuses_characters_outside_the_alphabet():
    with pytest.raises(ValueError):
        decode_polyline("_p~iF ~ps|U")
