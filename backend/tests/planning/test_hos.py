from datetime import UTC, datetime, timedelta

import pytest

from core.constants import StopKind, TruckStatus
from planning.hos import Stop, eta, state_at, stops

H = 3600
DEPART = datetime(2026, 11, 3, 6, 0, tzinfo=UTC)  # 6:00 AM
TOTAL_900 = 54_000  # 900 mi at 60 mph


def test_hos_off_has_no_stops_and_eta_is_driving_time():
    assert stops(TOTAL_900, False) == []
    assert eta(DEPART, 10_000, []) == DEPART + timedelta(seconds=10_000)


def test_spec_example_900_miles():
    s = stops(TOTAL_900, True)
    assert s == [
        Stop(8 * H, 1800, StopKind.BREAK),
        Stop(11 * H, 10 * H, StopKind.REST),
    ]
    # Break starts at wall 2:00 PM, rest at wall 5:30 PM, arrival 7:30 AM next day.
    assert eta(DEPART, 8 * H, s) == datetime(2026, 11, 3, 14, 0, tzinfo=UTC)
    assert eta(DEPART, 11 * H, s) == datetime(2026, 11, 3, 17, 30, tzinfo=UTC)
    assert eta(DEPART, TOTAL_900, s) == datetime(2026, 11, 4, 7, 30, tzinfo=UTC)


def test_eta_counts_only_stops_strictly_before():
    s = stops(TOTAL_900, True)
    assert eta(DEPART, 8 * H - 1, s) == DEPART + timedelta(seconds=8 * H - 1)
    assert eta(DEPART, 8 * H + 1, s) == DEPART + timedelta(seconds=8 * H + 1 + 1800)


def test_no_stop_at_destination():
    assert stops(8 * H, True) == []
    assert stops(8 * H - 1, True) == []
    assert stops(11 * H, True) == [Stop(8 * H, 1800, StopKind.BREAK)]


def test_break_just_before_destination_is_taken():
    assert stops(8 * H + 1, True) == [Stop(8 * H, 1800, StopKind.BREAK)]


def test_long_trip_resets_both_counters_after_rest():
    # Break at 8 h, rest at 11 h (resets both), break at 19 h, rest at 22 h, then the
    # next break would be at 30 h which is the destination, so it is not taken.
    s = stops(30 * H, True)
    assert [(x.at_drive_s, x.kind) for x in s] == [
        (8 * H, StopKind.BREAK),
        (11 * H, StopKind.REST),
        (19 * H, StopKind.BREAK),
        (22 * H, StopKind.REST),
    ]


def test_break_resets_only_the_break_counter():
    # Break at 8 h; the next break would be due at 16 h but the rest at 11 h comes first.
    s = stops(12 * H, True)
    assert [x.kind for x in s] == [StopKind.BREAK, StopKind.REST]


def test_state_at_driving_before_first_stop():
    s = stops(TOTAL_900, True)
    assert state_at(1 * H, s, TOTAL_900) == (1 * H, TruckStatus.DRIVING)


def test_state_at_break():
    s = stops(TOTAL_900, True)
    # 8 h 10 min of wall time: inside the 30 min break that began at drive 8 h.
    assert state_at(8 * H + 600, s, TOTAL_900) == (8 * H, TruckStatus.BREAK)


def test_state_at_rest():
    s = stops(TOTAL_900, True)
    # Break ends at wall 8 h 30 min; rest starts at wall 11 h 30 min. Wall 12 h is in the rest.
    assert state_at(12 * H, s, TOTAL_900) == (11 * H, TruckStatus.REST)


def test_state_at_driving_after_break_counts_driving_seconds_only():
    s = stops(TOTAL_900, True)
    # Wall 8 h 40 min: 8 h of driving plus 10 min more after the break.
    assert state_at(8 * H + 2400, s, TOTAL_900) == (8 * H + 600, TruckStatus.DRIVING)


@pytest.mark.parametrize("wall_s", [25 * H + 1800, 26 * H, 40 * H])
def test_state_at_arrived(wall_s):
    s = stops(TOTAL_900, True)
    assert state_at(wall_s, s, TOTAL_900) == (TOTAL_900, TruckStatus.ARRIVED)


def test_state_at_just_before_arrival_is_driving():
    s = stops(TOTAL_900, True)
    drive, status = state_at(25 * H + 1799, s, TOTAL_900)
    assert status == TruckStatus.DRIVING
    assert drive == pytest.approx(TOTAL_900 - 1)


def test_state_at_without_hos():
    assert state_at(100.0, [], 1000.0) == (100.0, TruckStatus.DRIVING)
    assert state_at(1000.0, [], 1000.0) == (1000.0, TruckStatus.ARRIVED)
