"""Synthetic straight routes for tests, with exact lengths and a constant speed."""

from datetime import UTC, datetime

from core.constants import METERS_PER_MILE, RouteSource
from planning.geo import haversine_m
from planning.track import RouteTrack

SPEED_MPS = 60 * METERS_PER_MILE / 3600  # exactly 60 mph
DEPARTURE = datetime(2026, 11, 3, 12, 0, tzinfo=UTC)


def straight_track(
    length_mi: float,
    lat: float = 38.5,
    lon0: float = -98.0,
    step_mi: float = 1.0,
    order: int = 0,
) -> RouteTrack:
    """A west-to-east line of latitude. Cumulative distance is exact; drive_s is 60 mph."""
    deg_per_mile = METERS_PER_MILE / haversine_m(lat, lon0, lat, lon0 + 1.0)
    miles = [0.0]
    while miles[-1] + step_mi < length_mi:
        miles.append(miles[-1] + step_mi)
    miles.append(float(length_mi))
    points = tuple((lat, lon0 + m * deg_per_mile) for m in miles)
    dist = tuple(m * METERS_PER_MILE for m in miles)
    drive = tuple(d / SPEED_MPS for d in dist)
    return RouteTrack(points, dist, drive, RouteSource.API, order)


def line_track(a: tuple[float, float], b: tuple[float, float], n: int = 200) -> RouteTrack:
    """A straight line between two places with haversine distances and 60 mph driving time."""
    points = tuple(
        (a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n) for i in range(n + 1)
    )
    dist = [0.0]
    for p, q in zip(points, points[1:], strict=False):
        dist.append(dist[-1] + haversine_m(p[0], p[1], q[0], q[1]))
    drive = tuple(d / SPEED_MPS for d in dist)
    return RouteTrack(points, tuple(dist), drive, RouteSource.API, 0)


def track_through(
    points: list[tuple[float, float]],
    time_factor: float = 1.0,
    source: RouteSource = RouteSource.API,
    order: int = 0,
) -> RouteTrack:
    """A track over the given (lat, lon) points. drive_s is 60 mph times time_factor."""
    dist = [0.0]
    for p, q in zip(points, points[1:], strict=False):
        dist.append(dist[-1] + haversine_m(p[0], p[1], q[0], q[1]))
    drive = tuple(d / SPEED_MPS * time_factor for d in dist)
    return RouteTrack(tuple(points), tuple(dist), drive, source, order)
