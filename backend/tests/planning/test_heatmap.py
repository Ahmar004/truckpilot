from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from synthetic import DEPARTURE, straight_track

import planning.heatmap as heatmap_module
from core.constants import CELL_DEGS_HEATMAP, FORECAST_WINDOW_H, HEATMAP_HOURS, Level
from planning.checkpoints import forecast_hour, place_checkpoints
from planning.heatmap import corridor, heatmap
from planning.risk import rate
from weather.cells import cell_index, key_of
from weather.forecast import Forecast

D05, D10, D20 = CELL_DEGS_HEATMAP

NOW = DEPARTURE - timedelta(hours=1)


def test_corridor_single_cell():
    # A 6 mi trip at 10 mi: Checkpoints only at mile 0 and the destination, one heatmap cell.
    track = straight_track(6)
    assert [c.mile for c in place_checkpoints(track, 10, DEPARTURE, [])] == [0, 6]
    centre = cell_index(38.5, -97.95, D05)
    assert corridor([track], D05, ring=False) == {centre}
    assert corridor([track], D05, ring=True) == {
        (centre[0] + di, centre[1] + dj) for di in (-1, 0, 1) for dj in (-1, 0, 1)
    }


def test_corridor_covers_every_cell_the_line_crosses():
    # About 280 mi due east at lat 38.5 is about 5.2 degrees of longitude: 11 or 12 cells wide.
    track = straight_track(280)
    cells = corridor([track], D05, ring=False)
    assert {i for i, _ in cells} == {77}
    js = sorted(j for _, j in cells)
    assert js == list(range(js[0], js[-1] + 1))
    assert 11 <= len(js) <= 12


def test_corridor_of_several_routes_is_the_union():
    a, b = straight_track(100, lat=38.5), straight_track(100, lat=42.0)
    both = corridor([a, b], D10, ring=False)
    assert both == corridor([a], D10, ring=False) | corridor([b], D10, ring=False)


def test_corridor_cell_index_uses_floor_for_negative_longitudes():
    track = straight_track(1, lat=0.25, lon0=-0.25)
    assert (0, -1) in corridor([track], D05, ring=False)


def forecast(start, wind="10", rain="0", snow="0", hours=300):
    return Forecast(
        start_utc=start,
        wind_mph=(Decimal(wind),) * hours,
        rain_in=(Decimal(rain),) * hours,
        snow_in=(Decimal(snow),) * hours,
    )


CELL = (77, -196)
KEY = key_of(D05, *CELL)


def build(forecasts=None, departure=DEPARTURE, now=NOW, load_lb=20_000, cells=(CELL,)):
    forecasts = {KEY: forecast(DEPARTURE)} if forecasts is None else forecasts
    return heatmap(set(cells), forecasts, departure, now, load_lb, D05)


def test_heatmap_has_49_hours_and_49_characters_per_cell():
    result = build()
    assert result.cell_deg == D05
    assert len(result.hours) == HEATMAP_HOURS == 49
    assert [h.utc for h in result.hours] == [DEPARTURE + timedelta(hours=h) for h in range(49)]
    assert all(h.in_window for h in result.hours)
    (cell,) = result.cells
    assert (cell.i, cell.j) == CELL
    assert cell.lv == "0" * 49
    assert cell.cz == (0,) * 49


def test_heatmap_is_none_when_hour_0_is_past_the_window():
    departure = NOW + timedelta(hours=FORECAST_WINDOW_H + 1)
    assert build(departure=departure) is None


def test_hours_past_the_window_are_dashes_in_every_cell():
    # Window ends 10 h after departure, so hours 0 to 10 are rated and 11 to 48 are "-".
    now = DEPARTURE - timedelta(hours=FORECAST_WINDOW_H - 10)
    other = (77, -195)
    forecasts = {KEY: forecast(DEPARTURE, wind="30"), key_of(D05, *other): forecast(DEPARTURE)}
    result = build(forecasts, now=now, cells=(CELL, other))
    assert [h.in_window for h in result.hours] == [True] * 11 + [False] * 38
    for cell in result.cells:
        assert len(cell.lv) == len(cell.cz) == 49
        assert cell.lv[11:] == "-" * 38
        assert cell.cz[11:] == (0,) * 38
    assert {c.lv[:11] for c in result.cells} == {"0" * 11, "1" * 11}


def test_an_hour_with_no_forecast_data_is_a_dash_even_inside_the_window():
    short = forecast(DEPARTURE, hours=5)
    result = build({KEY: short})
    assert result.cells[0].lv == "0" * 5 + "-" * 44
    assert result.cells[0].cz[5:] == (0,) * 44


def test_a_missing_value_in_the_series_is_a_dash():
    base = forecast(DEPARTURE)
    wind = (base.wind_mph[0], None, *base.wind_mph[2:])
    gap = Forecast(DEPARTURE, wind, base.rain_in, base.snow_in)
    assert build({KEY: gap}).cells[0].lv.startswith("0-0")


def test_levels_and_cause_bits():
    # Hour 0 wind 30 (Moderate), hour 1 rain 0.30 (High), hour 2 snow 2.5 (Severe),
    # hour 3 wind 36 and rain 0.30 (High, two causes).
    hours = 48
    wind = [Decimal(w) for w in ("30", "10", "10", "36")] + [Decimal("10")] * (hours + 1)
    rain = [Decimal(r) for r in ("0", "0.30", "0", "0.30")] + [Decimal("0")] * (hours + 1)
    snow = [Decimal(s) for s in ("0", "0", "2.5", "0")] + [Decimal("0")] * (hours + 1)
    fc = Forecast(DEPARTURE, tuple(wind), tuple(rain), tuple(snow))
    cell = build({KEY: fc}).cells[0]
    assert cell.lv[:5] == "12320"
    assert cell.cz[:5] == (1, 2, 4, 3, 0)


def test_a_load_rule_that_raises_the_wind_sets_bit_8():
    # Wind 47 is Severe; a load above 30,000 lb raises it to No Travel (spec 8.3).
    fc = forecast(DEPARTURE, wind="47")
    heavy = build({KEY: fc}, load_lb=35_000).cells[0]
    light = build({KEY: fc}, load_lb=20_000).cells[0]
    assert heavy.lv[0] == str(int(Level.NO_TRAVEL))
    assert heavy.cz[0] == 1 + 8
    assert light.lv[0] == str(int(Level.SEVERE))
    assert light.cz[0] == 1


def test_every_cell_and_hour_is_rated_by_the_risk_engine(monkeypatch):
    calls = []

    def spy(wind, rain, snow, load_lb):
        calls.append((wind, rain, snow, load_lb))
        return rate(wind, rain, snow, load_lb)

    monkeypatch.setattr(heatmap_module, "rate", spy)
    build(load_lb=12_345)
    assert len(calls) == 49
    assert calls[0] == (Decimal("10"), Decimal("0"), Decimal("0"), 12_345)


def test_each_cell_uses_its_own_forecast_and_cells_are_sorted():
    a, b = (77, -196), (76, -197)
    forecasts = {
        key_of(D05, *a): forecast(DEPARTURE, wind="60"),
        key_of(D05, *b): forecast(DEPARTURE, wind="10"),
    }
    result = build(forecasts, cells=(a, b))
    assert [(c.i, c.j) for c in result.cells] == [b, a]
    assert [c.lv[0] for c in result.cells] == ["0", "4"]


def test_a_missing_forecast_for_a_cell_is_a_mistake_not_a_dash():
    with pytest.raises(KeyError):
        build({})


def test_naive_times_are_refused():
    with pytest.raises(ValueError):
        build(departure=datetime(2026, 11, 3, 12, 0))


def test_newfoundland_half_hour_never_reaches_the_forecast_as_a_half_hour():
    # Departing 13:00 NST (UTC-3:30) is 16:30 UTC. Every forecast hour is rounded to a whole
    # UTC hour, so Forecast.at (which refuses half hours) is never given 16:30.
    departure = datetime(2026, 11, 3, 16, 30, tzinfo=UTC)
    track = straight_track(60, lat=48.9, lon0=-56.0)
    for cp in place_checkpoints(track, 10, departure, []):
        assert cp.tz == "America/St_Johns"
        hour = forecast_hour(cp.eta_utc)
        assert (hour.minute, hour.second) == (0, 0)
        forecast(datetime(2026, 11, 3, 16, 0, tzinfo=UTC)).at(hour)
    cell = cell_index(48.9, -55.5, D05)
    fc = {key_of(D05, *cell): forecast(datetime(2026, 11, 3, 16, 0, tzinfo=UTC))}
    result = heatmap({cell}, fc, departure, departure - timedelta(hours=1), 20_000, D05)
    assert result.cells[0].lv == "0" * 49
    assert result.hours[0].utc == departure
