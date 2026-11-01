from datetime import datetime

import pytest
from synthetic import DEPARTURE, straight_track

from core.constants import HEATMAP_HOURS, TruckStatus
from planning.hos import stops
from planning.truck import truck_at, truck_positions

DRIVING, BREAK, REST, ARRIVED = (
    TruckStatus.DRIVING,
    TruckStatus.BREAK,
    TruckStatus.REST,
    TruckStatus.ARRIVED,
)


def positions(length_mi, hos_on):
    track = straight_track(length_mi)
    return track, truck_positions(track, stops(track.driving_s, hos_on), DEPARTURE)


def test_always_49_positions_hour_0_is_the_origin():
    track, result = positions(300, hos_on=False)
    assert len(result) == HEATMAP_HOURS == 49
    assert (result[0].lat, result[0].lon) == track.points[0]
    assert (result[0].mile, result[0].status) == (0, DRIVING)


def test_driving_without_hos_then_arrived_at_the_destination():
    # 300 mi at 60 mph takes 5 h.
    track, result = positions(300, hos_on=False)
    assert result[3].mile == pytest.approx(180, abs=1e-6)
    assert result[3].status == DRIVING
    for h in range(5, 49):
        assert result[h].status == ARRIVED
        assert result[h].mile == pytest.approx(300, abs=1e-6)
        assert (result[h].lat, result[h].lon) == track.points[-1]


def test_the_truck_stays_still_during_a_break():
    # 700 mi: a 30 min break after 8 h (mile 480). Hour 8 starts the break.
    _, result = positions(700, hos_on=True)
    assert result[7].status == DRIVING
    assert result[8].status == BREAK
    assert result[8].mile == pytest.approx(480, abs=1e-6)
    assert result[9].status == DRIVING
    assert result[9].mile == pytest.approx(510, abs=1e-6)  # 30 min of the hour was the break


def test_the_truck_stays_still_during_a_rest_and_arrives_after_it():
    # 1,000 mi: break at 8 h, rest after 11 h of driving (wall hour 11.5 to 21.5), 16.67 h of
    # driving in all, so the truck arrives at wall hour 27.17.
    _, result = positions(1000, hos_on=True)
    assert result[11].status == DRIVING
    assert result[11].mile == pytest.approx(630, abs=1e-6)
    resting = [result[h] for h in range(12, 22)]
    assert {p.status for p in resting} == {REST}
    assert {(p.lat, p.lon, p.mile) for p in resting} == {
        (resting[0].lat, resting[0].lon, resting[0].mile)
    }
    assert resting[0].mile == pytest.approx(660, abs=1e-6)
    assert result[27].status == DRIVING
    assert result[28].status == ARRIVED
    assert result[28].mile == pytest.approx(1000, abs=1e-6)


def test_a_negative_offset_is_treated_as_the_departure():
    track = straight_track(300)
    pos = truck_at(track, stops(track.driving_s, True), -3600.0)
    assert (pos.mile, pos.status) == (0, DRIVING)
    assert (pos.lat, pos.lon) == track.points[0]


def test_naive_departure_is_refused():
    track = straight_track(300)
    with pytest.raises(ValueError):
        truck_positions(track, [], datetime(2026, 11, 3, 12, 0))
