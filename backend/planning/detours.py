"""Detour routes: Waypoint placement, the backtrack and shared-road tests, and the ladder
(spec 6.2, architecture 6.4).

Pure rules over plain data. They work on TomTom's raw points, never the simplified tracks:
two 20 m simplifications of one road can sit up to 40 m apart and hide shared road from the
25 m match.

Both tests sample a track every SAMPLE_STEP_M and ask whether a sample is within MATCH_M of a
road. Points are projected to Mercator metres (so one flat grid covers a 1,500 mi trip), where
a true distance of m metres at latitude L is m / cos(L), so the match distance is scaled per
sample. A grid index keeps each lookup to the few segments in one cell.
"""

import math
from dataclasses import dataclass, field

from core.constants import (
    DETOUR_OFFSETS,
    DOUBLED_BACK_M,
    EARTH_RADIUS_M,
    LADDER_STEPS,
    MATCH_M,
    SAMPLE_STEP_M,
    TOP_ROUTES,
    US_CANADA_ZONES,
)
from planning.geo import haversine_m
from planning.track import RouteTrack
from planning.zones import zone_at

LatLon = tuple[float, float]

# Grid cell side in Mercator metres. A segment is listed in every cell its box (grown by the
# match distance) touches, so a lookup reads one cell.
_CELL_M = 800.0
_CELL_KEY_STRIDE = 1 << 20
# Added to every Mercator coordinate so that all are positive and int() is a floor.
_SHIFT_M = 2.2e7
# Slack in metres on the grown box, so rounding never hides a segment from its cell.
_BOX_SLACK_M = 1.0


# --- Waypoints -------------------------------------------------------------------------


def _bearing_deg(a: LatLon, b: LatLon) -> float:
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dl = math.radians(b[1] - a[1])
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return math.degrees(math.atan2(y, x))


def _destination_point(start: LatLon, bearing_deg: float, distance_m: float) -> LatLon:
    """The point reached from start by going distance_m along a great circle at a bearing."""
    angular = distance_m / EARTH_RADIUS_M
    brg = math.radians(bearing_deg)
    p1, l1 = math.radians(start[0]), math.radians(start[1])
    p2 = math.asin(
        math.sin(p1) * math.cos(angular) + math.cos(p1) * math.sin(angular) * math.cos(brg)
    )
    l2 = l1 + math.atan2(
        math.sin(brg) * math.sin(angular) * math.cos(p1),
        math.cos(angular) - math.sin(p1) * math.sin(p2),
    )
    return math.degrees(p2), (math.degrees(l2) + 540) % 360 - 180


def waypoints(fastest: RouteTrack, origin: LatLon, destination: LatLon) -> list[LatLon]:
    """Waypoints for the detour round, in the order left 15%, right 15%, left 30%, right 30%.

    They start at the point halfway along the fastest route and step at right angles to the
    straight origin-to-destination line, by DETOUR_OFFSETS of that line's length. A Waypoint
    outside the US and Canada zone list (the sea, Mexico) is left out.
    """
    lat, lon, _ = fastest.at_distance(fastest.dist_m[-1] / 2)
    middle = (lat, lon)
    trip_m = haversine_m(*origin, *destination)
    heading = _bearing_deg(origin, destination)
    found = []
    for share in DETOUR_OFFSETS:
        for turn in (-90, 90):
            point = _destination_point(middle, heading + turn, share * trip_m)
            if zone_at(*point) in US_CANADA_ZONES:
                found.append(point)
    return found


# --- Projection, samples and the grid ----------------------------------------------------


class _Line:
    """A track in shifted Mercator metres."""

    def __init__(self, track: RouteTrack) -> None:
        self.track = track
        k = EARTH_RADIUS_M * math.pi / 180
        quarter = math.pi / 4
        radians = math.radians
        lats = [radians(p[0]) for p in track.points]
        self.xs = [p[1] * k + _SHIFT_M for p in track.points]
        self.ys = [
            EARTH_RADIUS_M * math.log(math.tan(quarter + lat / 2)) + _SHIFT_M for lat in lats
        ]
        # 1 / cos(latitude): a true distance is this many Mercator metres.
        self.secs = [1 / math.cos(lat) for lat in lats]
        # How far a segment's box is grown (see _Grid): the match distance, scaled, plus slack.
        self.pads = [MATCH_M * sec + _BOX_SLACK_M for sec in self.secs]
        self._samples: tuple[list[float], list[float], list[float], list[float]] | None = None

    def samples(self) -> tuple[list[float], list[float], list[float], list[float]]:
        """x, y, distance along the track and squared match distance, every SAMPLE_STEP_M."""
        if self._samples is None:
            self._samples = self._sample()
        return self._samples

    def _sample(self) -> tuple[list[float], list[float], list[float], list[float]]:
        dist, xs, ys, secs = self.track.dist_m, self.xs, self.ys, self.secs
        total = dist[-1]
        last = len(dist) - 2
        count = int(total // SAMPLE_STEP_M) + 1
        at = [k * SAMPLE_STEP_M for k in range(count)]
        if total - at[-1] > 0:
            at.append(total)
        sx, sy, tol2 = [], [], []
        i = 0
        for d in at:
            while i < last and dist[i + 1] < d:
                i += 1
            span = dist[i + 1] - dist[i]
            f = (d - dist[i]) / span if span > 0 else 0.0
            f = min(max(f, 0.0), 1.0)
            sx.append(xs[i] + (xs[i + 1] - xs[i]) * f)
            sy.append(ys[i] + (ys[i + 1] - ys[i]) * f)
            tol = MATCH_M * (secs[i] + (secs[i + 1] - secs[i]) * f)
            tol2.append(tol * tol)
        return sx, sy, at, tol2


class _Grid:
    """Segments in a grid of cells, for 'is this point within the match distance of a road'."""

    def __init__(self) -> None:
        self.cells: dict[int, list[tuple[float, float, float, float, float]]] = {}

    def add_range(self, line: _Line, first: int, last: int) -> None:
        """List the segments from point `first` to point `last` of the line."""
        xs, ys, pads = line.xs, line.ys, line.pads
        cells = self.cells
        inv = 1 / _CELL_M
        x0, y0, p0 = xs[first], ys[first], pads[first]
        for i in range(first + 1, last + 1):
            x1, y1, p1 = xs[i], ys[i], pads[i]
            dx = x1 - x0
            dy = y1 - y0
            pad = p0 if p0 > p1 else p1
            if dx < 0:
                ix_lo, ix_hi = int((x1 - pad) * inv), int((x0 + pad) * inv)
            else:
                ix_lo, ix_hi = int((x0 - pad) * inv), int((x1 + pad) * inv)
            if dy < 0:
                iy_lo, iy_hi = int((y1 - pad) * inv), int((y0 + pad) * inv)
            else:
                iy_lo, iy_hi = int((y0 - pad) * inv), int((y1 + pad) * inv)
            segment = (x0, y0, dx, dy, dx * dx + dy * dy)
            for ix in range(ix_lo, ix_hi + 1):
                base = ix * _CELL_KEY_STRIDE
                for iy in range(iy_lo, iy_hi + 1):
                    bucket = cells.get(base + iy)
                    if bucket is None:
                        cells[base + iy] = [segment]
                    else:
                        bucket.append(segment)
            x0, y0, p0 = x1, y1, p1

    def near(self, x: float, y: float, tol2: float) -> bool:
        """True when (x, y) is within the match distance (squared: tol2) of a segment."""
        bucket = self.cells.get(int(x * (1 / _CELL_M)) * _CELL_KEY_STRIDE + int(y * (1 / _CELL_M)))
        if bucket is None:
            return False
        for x0, y0, dx, dy, len2 in bucket:
            px = x - x0
            py = y - y0
            if len2 > 0:
                t = (px * dx + py * dy) / len2
                t = 0.0 if t < 0.0 else 1.0 if t > 1.0 else t
                px -= t * dx
                py -= t * dy
            if px * px + py * py <= tol2:
                return True
        return False


# --- Backtrack and shared share ----------------------------------------------------------


def _backtracks(line: _Line) -> bool:
    """Whether more than DOUBLED_BACK_M of samples in a row lie on the track's own earlier road.

    A segment counts as earlier only when it ends more than DOUBLED_BACK_M before the sample,
    so each segment is added to the grid once the walk is that far past it.
    """
    sx, sy, at, tol2 = line.samples()
    dist = line.track.dist_m
    grid = _Grid()
    listed = 0  # points 0..listed are in the grid as segments
    last_point = len(dist) - 1
    run = 0
    for k, d in enumerate(at):
        reach = d - DOUBLED_BACK_M
        end = listed
        while end < last_point and dist[end + 1] <= reach:
            end += 1
        if end > listed:
            grid.add_range(line, listed, end)
            listed = end
        if listed and grid.near(sx[k], sy[k], tol2[k]):
            run += 1
            if run * SAMPLE_STEP_M > DOUBLED_BACK_M:
                return True
        else:
            run = 0
    return False


def backtracks(track: RouteTrack) -> bool:
    """Whether the track doubles back on itself for more than 1 km (spec 6.2).

    A sample every 100 m "doubles back" when it is within 25 m of the same track more than 1 km
    earlier along it. A short overpass crossing is well under 1 km in a row; a spur into a
    Waypoint and back is not.
    """
    return _backtracks(_Line(track))


@dataclass
class _Candidate:
    """A detour candidate with its samples and what is known about its shared share."""

    track: RouteTrack
    index: int
    _line: _Line | None = field(default=None, init=False)
    unshared: list[int] | None = field(default=None, init=False)
    checked: int = field(default=0, init=False)
    dropped: bool = field(default=False, init=False)

    @property
    def line(self) -> _Line:
        if self._line is None:
            self._line = _Line(self.track)
        return self._line

    def share(self, grids: list[_Grid]) -> float:
        """Shared samples over all samples against the grids; grids seen before are not redone."""
        sx, sy, _, tol2 = self.line.samples()
        if self.unshared is None:
            self.unshared = list(range(len(sx)))
        for grid in grids[self.checked :]:
            self.unshared = [k for k in self.unshared if not grid.near(sx[k], sy[k], tol2[k])]
        self.checked = len(grids)
        return 1 - len(self.unshared) / len(sx)


def shared_share(candidate: RouteTrack, kept: list[RouteTrack]) -> float:
    """The share of the candidate's length that runs on a road of a kept route (0 to 1).

    The candidate is sampled every 100 m; a sample is shared when it is within 25 m of any
    segment of any kept route. With no kept routes the share is 0.
    """
    grid = _Grid()
    for track in kept:
        line = _Line(track)
        grid.add_range(line, 0, len(line.xs) - 1)
    return _Candidate(candidate, 0).share([grid])


# --- The ladder --------------------------------------------------------------------------


def apply_ladder(api_routes: list[RouteTrack], candidates: list[RouteTrack]) -> list[RouteTrack]:
    """The routes to rate: the API routes, then detours kept by the ladder (spec 6.2).

    For each ladder step, while there are fewer than 3 routes, the candidate with the shortest
    driving time that fits the step's time limit (against the fastest API route) and shares no
    more than the step's share with ALL routes kept so far is kept. A candidate that backtracks
    is never kept. A tie in driving time keeps the earlier candidate. A candidate that repeats an
    earlier one exactly is ignored.

    Backtracks are tested only for a candidate that would otherwise be kept, which gives the
    same result as dropping backtracking candidates first.
    """
    if not api_routes:
        raise ValueError("the ladder needs at least one API route")
    base = min(t.driving_s for t in api_routes)
    kept = list(api_routes)
    grids: list[_Grid] = []
    # Waypoints that snap to the same road give the same answer again; the first copy is enough
    # (a later copy would share all its road with it, or backtrack like it).
    seen = set()
    unique = []
    for i, track in enumerate(candidates):
        key = (track.points, track.drive_s)
        if key not in seen:
            seen.add(key)
            unique.append(_Candidate(track, i))
    pool = sorted(unique, key=lambda c: (c.track.driving_s, c.index))

    def grids_for_kept() -> list[_Grid]:
        while len(grids) < len(kept):
            grid = _Grid()
            line = _Line(kept[len(grids)])
            grid.add_range(line, 0, len(line.xs) - 1)
            grids.append(grid)
        return grids

    for time_factor, max_share in LADDER_STEPS:
        limit = time_factor * base
        while len(kept) < TOP_ROUTES:
            pick = None
            for cand in pool:
                if cand.track.driving_s > limit:
                    break
                if cand.dropped:
                    continue
                if cand.share(grids_for_kept()) > max_share:
                    continue
                if _backtracks(cand.line):
                    cand.dropped = True
                    continue
                pick = cand
                break
            if pick is None:
                break
            kept.append(pick.track)
            pool.remove(pick)
    return kept
