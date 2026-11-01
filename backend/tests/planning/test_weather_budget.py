import math
from datetime import timedelta

import pytest
from synthetic import DEPARTURE, straight_track, track_through

from core.constants import (
    CELL_DEGS_HEATMAP,
    FORECAST_WINDOW_H,
    INTERVAL_AUTO,
    INTERVAL_LONG_MI,
    INTERVAL_MEDIUM_MI,
    INTERVAL_SHORT_MI,
    MAX_WEATHER_LOCATIONS,
)
from planning.heatmap import corridor
from planning.weather_budget import checkpoint_cells, heatmap_grid, interval_choice

D05, D10, D20 = CELL_DEGS_HEATMAP

CHICAGO = (41.8781, -87.6298)
DALLAS = (32.7767, -96.7970)
LOS_ANGELES = (34.0522, -118.2437)
NEW_YORK = (40.7128, -74.0060)
MIAMI = (25.7617, -80.1918)
ANCHORAGE = (61.2181, -149.9003)

NOW = DEPARTURE - timedelta(hours=1)


def bent(a, b, bend_deg, n=300):
    """A line from a to b that bows sideways (in latitude) by bend_deg at its middle."""
    points = [
        (
            a[0] + (b[0] - a[0]) * k / n + bend_deg * math.sin(math.pi * k / n),
            a[1] + (b[1] - a[1]) * k / n,
        )
        for k in range(n + 1)
    ]
    return track_through(points)


def three_routes(a, b, bend_deg):
    """Three distinct routes: the straight one and one bowing each way."""
    return [bent(a, b, 0.0), bent(a, b, bend_deg), bent(a, b, -bend_deg)]


def test_chicago_to_dallas_auto_uses_50_and_half_degree_cells():
    tracks = three_routes(CHICAGO, DALLAS, 3.5)
    choice = interval_choice(tracks, INTERVAL_AUTO, DEPARTURE, NOW, hos_on=False)
    assert (choice.used_mi, choice.requested_mi) == (INTERVAL_LONG_MI, None)
    c = len(checkpoint_cells(tracks, choice.used_mi, DEPARTURE, NOW, hos_on=False))
    assert heatmap_grid(c, tracks) == (D05, True)


def test_chicago_to_dallas_picking_10_is_allowed_and_uses_one_degree_cells():
    tracks = three_routes(CHICAGO, DALLAS, 3.5)
    choice = interval_choice(tracks, INTERVAL_SHORT_MI, DEPARTURE, NOW, hos_on=False)
    assert (choice.used_mi, choice.requested_mi) == (INTERVAL_SHORT_MI, None)
    c = len(checkpoint_cells(tracks, choice.used_mi, DEPARTURE, NOW, hos_on=False))
    assert heatmap_grid(c, tracks) == (D10, True)


def test_los_angeles_to_new_york_picking_10_uses_25_and_two_degree_cells():
    tracks = three_routes(LOS_ANGELES, NEW_YORK, 3.0)
    choice = interval_choice(tracks, INTERVAL_SHORT_MI, DEPARTURE, NOW, hos_on=False)
    assert (choice.used_mi, choice.requested_mi) == (INTERVAL_MEDIUM_MI, INTERVAL_SHORT_MI)
    assert [(o.mi, o.allowed) for o in choice.options] == [(10, False), (25, True), (50, True)]
    c = len(checkpoint_cells(tracks, choice.used_mi, DEPARTURE, NOW, hos_on=False))
    assert heatmap_grid(c, tracks) == (D20, True)


def test_50_is_always_allowed_and_the_heatmap_drops_the_ring_when_over_the_cap():
    # Miami to Anchorage: even 50 mi plus the coarsest corridor is above the cap.
    tracks = three_routes(MIAMI, ANCHORAGE, 6.0)
    choice = interval_choice(tracks, INTERVAL_SHORT_MI, DEPARTURE, NOW, hos_on=False)
    assert choice.used_mi == INTERVAL_LONG_MI
    assert choice.requested_mi == INTERVAL_SHORT_MI
    assert [(o.mi, o.allowed) for o in choice.options] == [(10, False), (25, False), (50, True)]
    c = len(checkpoint_cells(tracks, choice.used_mi, DEPARTURE, NOW, hos_on=False))
    assert c + len(corridor(tracks, D20, ring=True)) > MAX_WEATHER_LOCATIONS
    assert heatmap_grid(c, tracks) == (D20, False)


def test_auto_comes_from_the_fastest_route_not_the_first():
    slow = bent(CHICAGO, DALLAS, 3.5)
    fast = bent(CHICAGO, (CHICAGO[0] - 1.0, CHICAGO[1]), 0.0)  # about 70 mi
    choice = interval_choice([slow, fast], INTERVAL_AUTO, DEPARTURE, NOW, hos_on=False)
    assert choice.used_mi == INTERVAL_SHORT_MI


def test_the_same_trip_always_gets_the_same_answer():
    tracks = three_routes(LOS_ANGELES, NEW_YORK, 3.0)
    first = interval_choice(tracks, INTERVAL_SHORT_MI, DEPARTURE, NOW, hos_on=True)
    assert interval_choice(tracks, INTERVAL_SHORT_MI, DEPARTURE, NOW, hos_on=True) == first


def test_a_bad_interval_is_refused():
    with pytest.raises(ValueError):
        interval_choice([bent(CHICAGO, DALLAS, 0.0)], 15, DEPARTURE, NOW, hos_on=False)


def test_checkpoints_past_the_window_are_not_counted():
    # Departing exactly at the end of the window: only the Checkpoints that round to hour
    # 240 are inside (mile 0 and mile 25, 25 min later); mile 50 rounds up to hour 241.
    departure = NOW + timedelta(hours=FORECAST_WINDOW_H)
    assert len(checkpoint_cells([straight_track(100)], 25, departure, NOW, hos_on=False)) == 2


def test_hos_pushes_a_checkpoint_out_of_the_window():
    # A 600 mi trip departing 9 h before the window ends. Without HOS, Checkpoints up to mile
    # 550 are inside (23). With HOS, the break after 8 h (mile 480) adds 30 min, so the one at
    # mile 550 now rounds to hour 241 and only 22 are inside.
    departure = NOW + timedelta(hours=FORECAST_WINDOW_H - 9)
    track = straight_track(600)
    assert len(checkpoint_cells([track], 25, departure, NOW, hos_on=False)) == 23
    assert len(checkpoint_cells([track], 25, departure, NOW, hos_on=True)) == 22


def test_no_heatmap_hours_in_the_window_means_no_corridor_cost():
    # Departing past the window: no Checkpoint and no heatmap cell needs a forecast, so 10 mi
    # is allowed even for a coast to coast trip.
    tracks = three_routes(LOS_ANGELES, NEW_YORK, 3.0)
    departure = NOW + timedelta(hours=FORECAST_WINDOW_H + 5)
    choice = interval_choice(tracks, INTERVAL_SHORT_MI, departure, NOW, hos_on=False)
    assert (choice.used_mi, choice.requested_mi) == (INTERVAL_SHORT_MI, None)
    assert all(o.allowed for o in choice.options)
