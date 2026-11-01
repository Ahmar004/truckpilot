"""A Route as a track: points with cumulative distance and driving time."""

import math
from bisect import bisect_left
from dataclasses import dataclass

from core.constants import METERS_PER_MILE, RouteSource
from planning.geo import douglas_peucker


@dataclass(frozen=True)
class RouteTrack:
    """Points are (lat, lon). dist_m and drive_s are cumulative from the start."""

    points: tuple[tuple[float, float], ...]
    dist_m: tuple[float, ...]
    drive_s: tuple[float, ...]
    source: RouteSource
    order: int

    def __post_init__(self) -> None:
        n = len(self.points)
        if n < 2:
            raise ValueError("a track needs at least 2 points")
        if len(self.dist_m) != n or len(self.drive_s) != n:
            raise ValueError("points, dist_m and drive_s must have the same length")
        for name, seq in (("dist_m", self.dist_m), ("drive_s", self.drive_s)):
            if seq[0] != 0:
                raise ValueError(f"{name} must start at 0")
            if any(b < a for a, b in zip(seq, seq[1:], strict=False)):
                raise ValueError(f"{name} must never decrease")
        if not all(math.isfinite(v) for v in (*self.dist_m, *self.drive_s)):
            raise ValueError("dist_m and drive_s must be finite numbers")
        if not all(math.isfinite(v) for point in self.points for v in point):
            raise ValueError("every point must have a finite lat and lon")
        if self.dist_m[-1] <= 0:
            raise ValueError("a track must have a length above 0")

    @property
    def length_mi(self) -> float:
        return self.dist_m[-1] / METERS_PER_MILE

    @property
    def driving_s(self) -> float:
        return self.drive_s[-1]

    def _locate(self, key: tuple[float, ...], value: float) -> tuple[int, float]:
        """Segment start index and fraction along it for a value in a cumulative sequence.

        Where the sequence is flat the first point of the flat stretch is used.
        """
        value = max(0.0, min(value, key[-1]))
        i = bisect_left(key, value)
        if i == 0 or key[i] == value:
            return i, 0.0
        return i - 1, (value - key[i - 1]) / (key[i] - key[i - 1])

    def _lerp(self, seq: tuple[float, ...], i: int, f: float) -> float:
        if f == 0.0:
            return seq[i]
        return seq[i] + (seq[i + 1] - seq[i]) * f

    def _point(self, i: int, f: float) -> tuple[float, float]:
        if f == 0.0:
            return self.points[i]
        (la, lo), (lb, lob) = self.points[i], self.points[i + 1]
        return la + (lb - la) * f, lo + (lob - lo) * f

    def at_distance(self, m: float) -> tuple[float, float, float]:
        """(lat, lon, drive_s) at m metres from the start; m is clamped to the route."""
        i, f = self._locate(self.dist_m, m)
        lat, lon = self._point(i, f)
        return lat, lon, self._lerp(self.drive_s, i, f)

    def at_drive_s(self, s: float) -> tuple[float, float, float]:
        """(lat, lon, metres) after s seconds of driving; s is clamped to the route."""
        i, f = self._locate(self.drive_s, s)
        lat, lon = self._point(i, f)
        return lat, lon, self._lerp(self.dist_m, i, f)


def simplify(track: RouteTrack, tol_m: float) -> RouteTrack:
    """Drop points within tol_m of the line; kept points keep their original dist_m, drive_s."""
    keep = douglas_peucker(list(track.points), tol_m)
    return RouteTrack(
        points=tuple(track.points[i] for i in keep),
        dist_m=tuple(track.dist_m[i] for i in keep),
        drive_s=tuple(track.drive_s[i] for i in keep),
        source=track.source,
        order=track.order,
    )
