"""Geometry helpers: distance, line simplification and the encoded polyline format."""

import math

from core.constants import EARTH_RADIUS_M


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in metres."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def _offset_m(
    p: tuple[float, float], origin: tuple[float, float], cos_lat: float
) -> tuple[float, float]:
    """Flat (east, north) offset in metres of p from origin (equirectangular)."""
    k = EARTH_RADIUS_M * math.pi / 180
    return ((p[1] - origin[1]) * cos_lat * k, (p[0] - origin[0]) * k)


def _distance_to_segment_m(
    p: tuple[float, float], a: tuple[float, float], b: tuple[float, float]
) -> float:
    cos_lat = math.cos(math.radians((a[0] + b[0]) / 2))
    px, py = _offset_m(p, a, cos_lat)
    bx, by = _offset_m(b, a, cos_lat)
    seg2 = bx * bx + by * by
    if seg2 == 0:
        return math.hypot(px, py)
    t = max(0.0, min(1.0, (px * bx + py * by) / seg2))
    return math.hypot(px - t * bx, py - t * by)


def douglas_peucker(points: list[tuple[float, float]], tol_m: float) -> list[int]:
    """Indices of the points kept by Douglas-Peucker. Always includes the first and last."""
    n = len(points)
    if n <= 2:
        return list(range(n))
    keep = [False] * n
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    while stack:
        lo, hi = stack.pop()
        far_i, far_d = -1, tol_m
        for i in range(lo + 1, hi):
            d = _distance_to_segment_m(points[i], points[lo], points[hi])
            if d > far_d:
                far_i, far_d = i, d
        if far_i != -1:
            keep[far_i] = True
            stack.append((lo, far_i))
            stack.append((far_i, hi))
    return [i for i, k in enumerate(keep) if k]


def _encode_number(value: int) -> str:
    value = ~(value << 1) if value < 0 else value << 1
    out = []
    while value >= 0x20:
        out.append(chr((0x20 | (value & 0x1F)) + 63))
        value >>= 5
    out.append(chr(value + 63))
    return "".join(out)


def encode_polyline(points: list[tuple[float, float]], precision: int = 5) -> str:
    """Google encoded polyline of (lat, lon) points."""
    factor = 10**precision
    out = []
    prev_lat = prev_lon = 0
    for lat, lon in points:
        ilat = math.floor(lat * factor + 0.5)
        ilon = math.floor(lon * factor + 0.5)
        out.append(_encode_number(ilat - prev_lat))
        out.append(_encode_number(ilon - prev_lon))
        prev_lat, prev_lon = ilat, ilon
    return "".join(out)


def decode_polyline(encoded: str, precision: int = 5) -> list[tuple[float, float]]:
    """Decode a Google encoded polyline to (lat, lon) points."""
    factor = 10**precision
    points = []
    i = lat = lon = 0
    n = len(encoded)
    while i < n:
        deltas = []
        for _ in range(2):
            result = shift = 0
            while True:
                if i >= n:
                    raise ValueError("the encoded polyline ends in the middle of a point")
                b = ord(encoded[i]) - 63
                if not 0 <= b < 64:
                    raise ValueError("the encoded polyline has an invalid character")
                i += 1
                result |= (b & 0x1F) << shift
                shift += 5
                if b < 0x20:
                    break
            deltas.append(~(result >> 1) if result & 1 else result >> 1)
        lat += deltas[0]
        lon += deltas[1]
        points.append((lat / factor, lon / factor))
    return points
