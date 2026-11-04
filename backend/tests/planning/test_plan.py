import math
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from synthetic import line_track, straight_track, track_through

from core.constants import (
    CELL_DEG_CHECKPOINT,
    FORECAST_WINDOW_H,
    HEATMAP_HOURS,
    INTERVAL_AUTO,
    Cause,
    IntervalMode,
    Level,
    LoadUnit,
    Recommendation,
    RouteSource,
    TruckStatus,
)
from planning.bundle import make_bundle, read_bundle
from planning.checkpoints import forecast_hour, place_checkpoints
from planning.hos import stops
from planning.plan import PlaceInfo, PlanInputs, build_plan
from weather.cells import cell_key
from weather.forecast import Forecast

HOUR = timedelta(hours=1)
DEP = datetime(2026, 11, 3, 19, 0, tzinfo=UTC)  # Tue Nov 3, 1:00 PM CST
NOW = DEP - timedelta(days=1)
START = NOW.replace(minute=0, second=0, microsecond=0)
SERIES = 300

ORIGIN = PlaceInfo("Origin, KS, USA", 38.5, -98.0, "America/Chicago")
DEST = PlaceInfo("Destination, KS, USA", 38.5, -96.0, "America/Chicago")


def make_inputs(**changes):
    base = dict(
        origin=ORIGIN,
        destination=DEST,
        departure_utc=DEP,
        load_lb=42_000,
        load_value=42_000,
        load_unit=LoadUnit.LB,
        interval=25,
        hos=True,
    )
    base.update(changes)
    return PlanInputs(**base)


def series(default, special):
    return tuple(special.get(h, default) for h in range(SERIES))


def calm_forecast():
    zero = Decimal(0)
    return Forecast(START, series(zero, {}), series(zero, {}), series(zero, {}))


class Stub:
    """A get_forecasts that records its calls. Keys it has no entry for get calm weather."""

    def __init__(self, special=None):
        self.special = special or {}
        self.calls = []

    def __call__(self, keys):
        self.calls.append(list(keys))
        return {k: self.special.get(k, calm_forecast()) for k in keys}


def special_forecasts(track, weather_by_index, interval=25, hos=True):
    """Forecasts for the cells of chosen Checkpoints: index -> (wind, rain, snow) in strings."""
    cps = place_checkpoints(track, interval, DEP, stops(track.driving_s, hos))
    out = {}
    for index, (wind, rain, snow) in weather_by_index.items():
        cp = cps[index]
        h = (forecast_hour(cp.eta_utc) - START) // HOUR
        zero = Decimal(0)
        out[cell_key(cp.lat, cp.lon, CELL_DEG_CHECKPOINT)] = Forecast(
            START,
            series(zero, {h: Decimal(wind)}),
            series(zero, {h: Decimal(rain)}),
            series(zero, {h: Decimal(snow)}),
        )
    return out


def varied(keys):
    """Weather that differs from cell to cell, so levels vary along a route."""
    out = {}
    for key in keys:
        _, i, j = key.split(":")
        wind = Decimal((abs(int(i)) * 7 + abs(int(j)) * 13) % 70)
        zero = Decimal(0)
        out[key] = Forecast(START, series(wind, {}), series(zero, {}), series(zero, {}))
    return out


def worked_example_tracks():
    """Route A (100 mi), Route B (110 mi) and Route C (120 mi), 60 mph, on separate lines."""
    return [
        straight_track(100, lat=38.5, order=0),
        straight_track(110, lat=39.5, order=1),
        straight_track(120, lat=40.5, order=2),
    ]


def worked_example_stub(tracks):
    special = {}
    special |= special_forecasts(
        tracks[0],
        {
            0: ("20", "0", "0"),
            1: ("38", "0", "0"),
            2: ("22", "0.30", "0"),
            3: ("0", "0", "0.6"),
            4: ("0", "0", "0"),
        },
    )
    special |= special_forecasts(tracks[1], {1: ("0", "0.30", "0"), 2: ("0", "0.30", "0")})
    special |= special_forecasts(tracks[2], {0: ("60", "0", "0")})
    return Stub(special)


def bent(a, b, bend_deg, order, n=300):
    """A line from a to b that bows sideways (in latitude) by bend_deg at its middle."""
    points = [
        (
            a[0] + (b[0] - a[0]) * k / n + bend_deg * math.sin(math.pi * k / n),
            a[1] + (b[1] - a[1]) * k / n,
        )
        for k in range(n + 1)
    ]
    return track_through(points, order=order)


def route_by_id(plan, route_id):
    return next(r for r in plan.routes if r.id == route_id)


# The worked example of spec 13


def test_worked_example_route_a_checkpoints():
    tracks = worked_example_tracks()
    plan = build_plan(tracks, make_inputs(), NOW, worked_example_stub(tracks))
    a = route_by_id(plan, "r0")
    assert [(c.n, c.mile, c.of_mi, c.level, c.causes, c.load_rule) for c in a.checkpoints] == [
        (1, 0, 100, Level.LOW, (), False),
        (2, 25, 100, Level.SEVERE, (Cause.WIND,), True),
        (3, 50, 100, Level.HIGH, (Cause.RAIN,), False),
        (4, 75, 100, Level.MODERATE, (Cause.SNOW,), False),
        (5, 100, 100, Level.LOW, (), False),
    ]
    assert [c.covered_mi for c in a.checkpoints] == pytest.approx([12.5, 25, 25, 25, 12.5])
    assert [c.eta_utc for c in a.checkpoints] == [
        DEP + timedelta(minutes=m) for m in (0, 25, 50, 75, 100)
    ]
    assert [c.forecast_utc for c in a.checkpoints] == [
        DEP,
        DEP,
        DEP + HOUR,
        DEP + HOUR,
        DEP + 2 * HOUR,
    ]
    assert a.checkpoints[1].weather.wind_mph == Decimal("38")
    assert a.checkpoints[2].weather.rain_in == Decimal("0.30")
    assert a.checkpoints[3].weather.snow_in == Decimal("0.6")
    assert all(c.tz == "America/Chicago" for c in a.checkpoints)


def test_worked_example_route_a_numbers():
    tracks = worked_example_tracks()
    plan = build_plan(tracks, make_inputs(), NOW, worked_example_stub(tracks))
    a = route_by_id(plan, "r0")
    assert a.miles[Level.SEVERE] == pytest.approx(25)
    assert a.miles[Level.HIGH] == pytest.approx(25)
    assert a.miles[Level.MODERATE] == pytest.approx(25)
    assert a.miles[Level.LOW] == pytest.approx(25)
    assert a.miles[Level.NO_TRAVEL] == 0
    assert a.no_data_mi == 0
    assert a.average_risk == Decimal("1.50")
    assert a.distance_mi == pytest.approx(100)
    assert a.driving_s == pytest.approx(6000)
    assert a.travel_s == pytest.approx(6000)
    assert a.arrival_utc == DEP + timedelta(seconds=6000)
    assert a.arrival_tz == "America/Chicago"
    assert a.source == RouteSource.API


def test_worked_example_ranking():
    tracks = worked_example_tracks()
    plan = build_plan(tracks, make_inputs(), NOW, worked_example_stub(tracks))
    assert [(r.id, r.rank, r.recommendation) for r in plan.routes] == [
        ("r1", 1, Recommendation.RECOMMENDED),
        ("r0", 2, None),
        ("r2", 3, Recommendation.NOT_RECOMMENDED),
    ]
    assert plan.notices.do_not_travel is False
    assert plan.notices.fewer_routes is None
    b = route_by_id(plan, "r1")
    assert b.miles[Level.HIGH] == pytest.approx(50)
    assert b.miles[Level.SEVERE] == 0
    c = route_by_id(plan, "r2")
    assert c.miles[Level.NO_TRAVEL] == pytest.approx(12.5)


def test_every_route_with_no_travel_is_do_not_travel():
    tracks = worked_example_tracks()
    special = {}
    for track in tracks:
        special |= special_forecasts(track, {0: ("60", "0", "0")})
    plan = build_plan(tracks, make_inputs(), NOW, Stub(special))
    assert plan.notices.do_not_travel is True
    assert [r.recommendation for r in plan.routes] == [Recommendation.NOT_RECOMMENDED] * 3


def test_fewer_routes_notice_is_passed_through():
    track = straight_track(100)
    plan = build_plan([track], make_inputs(), NOW, Stub(), fewer_routes=1)
    assert plan.notices.fewer_routes == 1
    assert len(plan.routes) == 1


def test_trip_block_echoes_the_inputs_as_typed():
    inputs = make_inputs(load_lb=30_000, load_value=13_608, load_unit=LoadUnit.KG, hos=False)
    plan = build_plan([straight_track(100)], inputs, NOW, Stub())
    assert plan.trip.load_lb == 30_000
    assert plan.trip.load_value == 13_608
    assert plan.trip.load_unit == LoadUnit.KG
    assert plan.trip.hos is False
    assert plan.trip.departure_utc == DEP
    assert plan.trip.origin == ORIGIN
    assert plan.now_utc == NOW
    assert plan.window_end_utc == NOW + timedelta(hours=FORECAST_WINDOW_H)


def test_a_route_carries_its_line_and_49_truck_positions():
    track = straight_track(100)
    plan = build_plan([track], make_inputs(), NOW, Stub())
    route = plan.routes[0]
    assert route.line
    assert len(route.truck) == HEATMAP_HOURS
    assert route.truck[0].mile == 0
    assert route.truck[0].status == TruckStatus.DRIVING
    assert route.truck[-1].status == TruckStatus.ARRIVED
    assert route.truck[-1].mile == pytest.approx(100)


# Interval block


def test_a_fixed_interval_is_reported():
    plan = build_plan([straight_track(100)], make_inputs(interval=25), NOW, Stub())
    assert plan.interval.mode == IntervalMode.FIXED
    assert plan.interval.used_mi == 25
    assert plan.interval.requested_mi is None
    assert [(o.mi, o.allowed) for o in plan.interval.options] == [
        (10, True),
        (25, True),
        (50, True),
    ]


def test_auto_interval_follows_the_fastest_route_length():
    plan = build_plan([straight_track(100)], make_inputs(interval=INTERVAL_AUTO), NOW, Stub())
    assert plan.interval.mode == IntervalMode.AUTO
    assert plan.interval.used_mi == 10
    assert len(plan.routes[0].checkpoints) == 11


def test_a_requested_interval_that_does_not_fit_is_raised():
    # A 2,800 mi trip at 10 mi would need about 840 Checkpoint cells (architecture 6.5).
    tracks = [
        bent((34.05, -118.24), (40.71, -74.0), bend, order) for order, bend in enumerate((0, 4, -4))
    ]
    plan = build_plan(tracks, make_inputs(interval=10), NOW, Stub())
    assert plan.interval.used_mi == 25
    assert plan.interval.requested_mi == 10
    assert [o.allowed for o in plan.interval.options] == [False, True, True]


# Weather calls


def test_one_call_carries_checkpoint_and_heatmap_cells_and_no_clock():
    tracks = worked_example_tracks()
    stub = worked_example_stub(tracks)
    build_plan(tracks, make_inputs(), NOW, stub)
    assert len(stub.calls) == 1
    keys = stub.calls[0]
    assert len(keys) == len(set(keys))
    prefix = f"{CELL_DEG_CHECKPOINT}:"
    assert any(k.startswith(prefix) for k in keys)
    assert any(not k.startswith(prefix) for k in keys)


def test_a_missing_forecast_is_never_filled_in():
    with pytest.raises(KeyError):
        build_plan([straight_track(100)], make_inputs(), NOW, lambda keys: {})


def test_plan_beyond_window_no_weather_calls():
    def never(keys):
        raise AssertionError("no weather call is expected")

    base = [straight_track(100, order=i) for i in range(3)]
    tracks = [
        replace(t, drive_s=tuple(s * f for s in t.drive_s))
        for t, f in zip(base, (1.3, 1.0, 1.1), strict=True)
    ]
    inputs = make_inputs(departure_utc=NOW + timedelta(days=11))
    plan = build_plan(tracks, inputs, NOW, never)
    assert plan.heatmap is None
    for route in plan.routes:
        assert route.average_risk is None
        assert route.no_data_mi == pytest.approx(100)
        for cp in route.checkpoints:
            assert cp.weather is None
            assert cp.level is None
            assert cp.causes == ()
            assert cp.load_rule is False
            assert cp.forecast_utc is not None
    assert [r.id for r in plan.routes] == ["r1", "r2", "r0"]
    assert [r.recommendation for r in plan.routes] == [Recommendation.RECOMMENDED, None, None]


def test_some_checkpoints_past_the_window_have_no_weather_and_the_rest_do():
    track = straight_track(900)
    inputs = make_inputs(departure_utc=NOW + timedelta(hours=FORECAST_WINDOW_H - 4), interval=50)
    plan = build_plan([track], inputs, NOW, Stub())
    levels = [cp.level for cp in plan.routes[0].checkpoints]
    assert levels[0] == Level.LOW
    assert levels[-1] is None
    assert plan.heatmap is not None
    assert plan.heatmap.hours[0].in_window
    assert not plan.heatmap.hours[-1].in_window
    assert plan.routes[0].no_data_mi > 0


def test_heatmap_hours_start_at_departure():
    plan = build_plan([straight_track(100)], make_inputs(), NOW, Stub())
    assert plan.heatmap is not None
    assert plan.heatmap.hours[0].utc == DEP
    assert len(plan.heatmap.hours) == HEATMAP_HOURS
    assert plan.heatmap.cells


# Plan and update


def test_a_plan_and_an_update_rebuild_give_equal_plans(monkeypatch):
    monkeypatch.setattr("planning.bundle.timezone.now", lambda: NOW)  # bundle age check
    n = 3000
    wiggle = [(38.0 + 0.0001 * math.sin(k / 40) + k * 0.00003, -98.0 + k * 0.001) for k in range(n)]
    raw = [track_through(wiggle, order=0), track_through(wiggle, time_factor=1.2, order=1)]
    token, simplified = make_bundle(7, make_inputs(), NOW, raw)
    plan = build_plan(simplified, make_inputs(), NOW, varied)

    bundle = read_bundle(token, 7)
    update = build_plan(bundle.tracks, bundle.inputs, bundle.now_utc, varied)
    assert update == plan


def test_changing_hos_changes_only_timing():
    track = straight_track(650)
    on = build_plan([track], make_inputs(hos=True), NOW, varied)
    off = build_plan([track], make_inputs(hos=False), NOW, varied)
    a, b = on.routes[0], off.routes[0]
    assert a.line == b.line
    assert a.distance_mi == b.distance_mi
    assert a.driving_s == b.driving_s
    assert a.travel_s == pytest.approx(b.travel_s + 1800)  # one 30 min break after 8 h
    assert [c.mile for c in a.checkpoints] == [c.mile for c in b.checkpoints]
    assert a.checkpoints[-1].eta_utc == b.checkpoints[-1].eta_utc + timedelta(minutes=30)
    assert a.truck != b.truck
    assert on.interval == off.interval
    assert on.trip.hos is True and off.trip.hos is False


def test_changing_the_interval_changes_only_the_checkpoints():
    track = straight_track(650)
    p25 = build_plan([track], make_inputs(interval=25), NOW, varied)
    p50 = build_plan([track], make_inputs(interval=50), NOW, varied)
    a, b = p25.routes[0], p50.routes[0]
    assert len(a.checkpoints) > len(b.checkpoints)
    assert a.line == b.line
    assert a.truck == b.truck
    assert a.travel_s == b.travel_s
    assert (p25.interval.used_mi, p50.interval.used_mi) == (25, 50)


# Time zones


def test_checkpoints_keep_their_own_time_zone_across_a_zone_line():
    # Kansas City (Central) to Denver (Mountain).
    track = line_track((39.10, -94.58), (39.74, -104.99))
    plan = build_plan([track], make_inputs(interval=50), NOW, Stub())
    zones = [cp.tz for cp in plan.routes[0].checkpoints]
    assert zones[0] == "America/Chicago"
    assert zones[-1] == "America/Denver"
    assert plan.routes[0].arrival_tz == "America/Denver"


def test_newfoundland_checkpoints_use_the_newfoundland_zone():
    # St. John's to Gander.
    track = line_track((47.56, -52.71), (48.96, -54.61))
    plan = build_plan([track], make_inputs(interval=25), NOW, Stub())
    assert {cp.tz for cp in plan.routes[0].checkpoints} == {"America/St_Johns"}
    assert plan.routes[0].arrival_tz == "America/St_Johns"


# Input rules


def test_more_than_three_routes_is_refused():
    tracks = [straight_track(100, order=i) for i in range(4)]
    with pytest.raises(ValueError):
        build_plan(tracks, make_inputs(), NOW, Stub())


def test_two_routes_with_the_same_order_are_refused():
    tracks = [straight_track(100, order=0), straight_track(100, lat=39.5, order=0)]
    with pytest.raises(ValueError):
        build_plan(tracks, make_inputs(), NOW, Stub())
