from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from synthetic import DEPARTURE, line_track, straight_track

from core.constants import StopKind
from planning.checkpoints import auto_interval, forecast_hour, in_window, place_checkpoints
from planning.hos import Stop, stops

CHICAGO = (41.8781, -87.6298)
PITTSBURGH = (40.4406, -79.9959)


def utc(*args):
    return datetime(*args, tzinfo=UTC)


def test_112_miles_at_25():
    cps = place_checkpoints(straight_track(112), 25, DEPARTURE, [])
    assert [c.mile for c in cps] == [0, 25, 50, 75, 100, 112]
    assert [c.n for c in cps] == [1, 2, 3, 4, 5, 6]
    assert {c.of_mi for c in cps} == {112}


def test_exact_100_miles_ends_at_destination_without_duplicate():
    cps = place_checkpoints(straight_track(100.0), 25, DEPARTURE, [])
    assert [c.mile for c in cps] == [0, 25, 50, 75, 100]
    assert cps[-1].covered_mi == pytest.approx(12.5)


def test_covered_miles_100_at_25():
    t = straight_track(100.0)
    cps = place_checkpoints(t, 25, DEPARTURE, [])
    assert [c.covered_mi for c in cps] == pytest.approx([12.5, 25, 25, 25, 12.5], abs=1e-6)
    assert sum(c.covered_mi for c in cps) == pytest.approx(t.length_mi, abs=1e-6)


def test_destination_just_past_a_mark():
    t = straight_track(100.04)
    cps = place_checkpoints(t, 25, DEPARTURE, [])
    assert [c.mile for c in cps] == [0, 25, 50, 75, 100, 100]
    assert cps[-1].covered_mi == pytest.approx(0.02, abs=1e-6)
    assert cps[-2].covered_mi == pytest.approx(12.52, abs=1e-6)
    assert sum(c.covered_mi for c in cps) == pytest.approx(t.length_mi, abs=1e-6)


def test_short_route_two_checkpoints():
    cps = place_checkpoints(straight_track(6), 10, DEPARTURE, [])
    assert [c.mile for c in cps] == [0, 6]
    assert [c.covered_mi for c in cps] == pytest.approx([3, 3], abs=1e-6)


def test_destination_mile_rounds_half_up():
    assert place_checkpoints(straight_track(112.5), 25, DEPARTURE, [])[-1].mile == 113
    assert place_checkpoints(straight_track(112.49), 25, DEPARTURE, [])[-1].mile == 112


def test_position_drive_s_and_eta_without_hos():
    cps = place_checkpoints(straight_track(100.0), 25, DEPARTURE, [])
    assert cps[0].eta_utc == DEPARTURE
    assert cps[1].drive_s == pytest.approx(25 * 60)
    assert cps[1].eta_utc == DEPARTURE + timedelta(minutes=25)
    assert cps[1].lat == pytest.approx(38.5)
    assert cps[0].tz == "America/Chicago"


def test_eta_includes_hos_stops_before_checkpoint():
    # A break at drive 1 h (60 mi): the checkpoint at mile 50 is before it, mile 75 after it.
    s = [Stop(3600, 1800, StopKind.BREAK)]
    cps = place_checkpoints(straight_track(100.0), 25, DEPARTURE, s)
    assert cps[2].eta_utc == DEPARTURE + timedelta(minutes=50)
    assert cps[3].eta_utc == DEPARTURE + timedelta(minutes=75 + 30)


def test_hos_stops_from_total_drive_time_feed_eta():
    t = straight_track(600.0)
    cps = place_checkpoints(t, 50, DEPARTURE, stops(t.driving_s, True))
    # 10 h of driving: one break at 8 h, so the destination ETA is 10.5 h after departure.
    assert cps[-1].eta_utc == DEPARTURE + timedelta(hours=10, minutes=30)


@pytest.mark.parametrize(
    ("mi", "interval"),
    [(149.9, 10), (150, 25), (600, 25), (600.1, 50), (0.5, 10), (1000, 50)],
)
def test_auto_interval(mi, interval):
    assert auto_interval(mi) == interval


@pytest.mark.parametrize(
    ("eta", "hour"),
    [
        (utc(2026, 11, 3, 3, 15), utc(2026, 11, 3, 3)),
        (utc(2026, 11, 3, 3, 30), utc(2026, 11, 3, 4)),
        (utc(2026, 11, 3, 3, 40), utc(2026, 11, 3, 4)),
        (utc(2026, 11, 3, 3, 29, 59), utc(2026, 11, 3, 3)),
        (utc(2026, 11, 3, 3, 29, 59, 999_999), utc(2026, 11, 3, 3)),
        (utc(2026, 11, 3, 23, 45), utc(2026, 11, 4, 0)),
        (utc(2026, 11, 3, 3, 0), utc(2026, 11, 3, 3)),
    ],
)
def test_forecast_hour(eta, hour):
    assert forecast_hour(eta) == hour


def test_in_window():
    now = utc(2026, 11, 3, 12)
    assert in_window(now + timedelta(hours=240), now) is True
    assert in_window(now + timedelta(hours=241), now) is False
    assert in_window(now, now) is True


def test_eta_zone_per_checkpoint():
    track = line_track(CHICAGO, PITTSBURGH)
    departure = utc(2026, 11, 3, 19, 0)  # 1:00 PM CST
    cps = place_checkpoints(track, 50, departure, [])

    first, last = cps[0], cps[-1]
    assert first.tz == "America/Chicago"
    local_first = first.eta_utc.astimezone(ZoneInfo(first.tz))
    assert (local_first.hour, local_first.minute) == (13, 0)
    assert local_first.tzname() == "CST"

    assert last.tz == "America/New_York"
    local_last = last.eta_utc.astimezone(ZoneInfo(last.tz))
    assert local_last.tzname() == "EST"
    assert local_last.hour == (last.eta_utc - timedelta(hours=5)).hour

    for c in cps:
        local = c.eta_utc.astimezone(ZoneInfo(c.tz))
        assert local.utcoffset() is not None
        assert local.astimezone(UTC) == c.eta_utc
        # Both ends are on standard time (CST and EST), so the offsets are -6 h or -5 h.
        assert local.utcoffset() in {timedelta(hours=-6), timedelta(hours=-5)}


def test_place_checkpoints_refuses_non_positive_interval():
    for bad in (0, -25):
        with pytest.raises(ValueError):
            place_checkpoints(straight_track(100.0), bad, DEPARTURE, [])


def test_naive_datetimes_are_refused():
    naive = datetime(2026, 11, 3, 12, 0)
    with pytest.raises(ValueError):
        forecast_hour(naive)
    with pytest.raises(ValueError):
        in_window(naive, utc(2026, 11, 3, 12, 0))
    with pytest.raises(ValueError):
        in_window(utc(2026, 11, 3, 12, 0), naive)
    with pytest.raises(ValueError):
        place_checkpoints(straight_track(100.0), 25, naive, [])
