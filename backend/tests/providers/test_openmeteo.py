import asyncio
import logging
import time
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import httpx
import pytest
from conftest import openmeteo_answer

from core.constants import (
    FORECAST_DAYS,
    OPENMETEO_BATCH_SIZE,
    OPENMETEO_MAX_CONCURRENT,
    Provider,
    Service,
)
from core.errors import ProviderUnavailable
from providers import openmeteo
from weather.forecast import Forecast

NOW = datetime(2026, 11, 1, 10, 0, tzinfo=UTC)
START = datetime(2026, 11, 1, 0, 0, tzinfo=UTC)
POINTS = [(41.9, -87.6), (36.1, -95.9), (32.8, -96.8)]


@pytest.fixture
def meteo(serve):
    return serve(Provider.OPENMETEO, openmeteo_answer)


def test_parses_the_saved_answer_into_one_forecast_per_location(meteo, fixture_json):
    saved = fixture_json("openmeteo_3_locations.json")
    forecasts = openmeteo.fetch(POINTS, NOW)
    assert len(forecasts) == 3
    first = forecasts[0]
    assert first.start_utc == START
    assert len(first.wind_mph) == len(first.rain_in) == len(first.snow_in) == 264
    assert first.wind_mph[0] == Decimal(str(saved[0]["hourly"]["wind_speed_10m"][0]))
    assert all(isinstance(v, Decimal) for v in first.wind_mph)


def test_rain_is_rain_plus_showers_as_exact_decimals(meteo, fixture_json):
    saved = fixture_json("openmeteo_3_locations.json")[0]["hourly"]
    i = next(i for i, s in enumerate(saved["showers"]) if s)
    forecasts = openmeteo.fetch(POINTS[:1], NOW)
    expected = Decimal(str(saved["rain"][i])) + Decimal(str(saved["showers"][i]))
    assert forecasts[0].rain_in[i] == expected
    assert expected > Decimal(str(saved["rain"][i]))


def test_decimal_sum_does_not_drift_like_floats(serve):
    # 0.1 + 0.2 is 0.30000000000000004 in floats; the Forecast must hold exactly 0.3.
    def handler(request):
        hourly = {
            "time": [f"2026-11-01T{h:02d}:00" for h in range(24)],
            "wind_speed_10m": [0.1] * 24,
            "rain": [0.1] * 24,
            "showers": [0.2] * 24,
            "snowfall": [0.0] * 24,
        }
        return httpx.Response(200, json={"hourly": hourly})

    serve(Provider.OPENMETEO, handler)
    forecast = openmeteo.fetch(POINTS[:1], NOW)[0]
    assert forecast.rain_in[0] == Decimal("0.3")
    assert forecast.wind_mph[0] == Decimal("0.1")


def test_snow_answer_keeps_snowfall(serve, fixture_json):
    serve(Provider.OPENMETEO, lambda r: openmeteo_answer(r, "openmeteo_snow_3_locations.json"))
    saved = fixture_json("openmeteo_snow_3_locations.json")[2]["hourly"]
    forecasts = openmeteo.fetch(POINTS, NOW)
    i = next(i for i, s in enumerate(saved["snowfall"]) if s)
    assert forecasts[2].snow_in[i] == Decimal(str(saved["snowfall"][i]))
    assert forecasts[2].snow_in[i] > 0


def test_request_asks_for_the_documented_values(meteo):
    openmeteo.fetch(POINTS, NOW)
    (request,) = meteo
    params = request.url.params
    assert params["latitude"] == "41.9000,36.1000,32.8000"
    assert params["longitude"] == "-87.6000,-95.9000,-96.8000"
    assert params["hourly"] == "wind_speed_10m,rain,showers,snowfall"
    assert params["wind_speed_unit"] == "mph"
    assert params["precipitation_unit"] == "inch"
    assert params["timezone"] == "GMT"
    assert params["forecast_days"] == str(FORECAST_DAYS)


def test_forecast_at_gives_the_values_of_that_hour(meteo):
    forecast = openmeteo.fetch(POINTS[:1], NOW)[0]
    hour = START + timedelta(hours=7)
    assert forecast.at(hour) == (forecast.wind_mph[7], forecast.rain_in[7], forecast.snow_in[7])


def test_forecast_at_is_none_outside_the_series(meteo):
    forecast = openmeteo.fetch(POINTS[:1], NOW)[0]
    assert forecast.at(START - timedelta(hours=1)) is None
    assert forecast.at(START + timedelta(hours=264)) is None
    assert forecast.at(START + timedelta(hours=263)) is not None


def test_forecast_at_is_none_when_a_value_is_missing():
    d = Decimal
    forecast = Forecast(START, (d(1), None, d(1)), (d(0), d(0), None), (d(0), d(0), d(0)))
    assert forecast.at(START) == (d(1), d(0), d(0))
    assert forecast.at(START + timedelta(hours=1)) is None
    assert forecast.at(START + timedelta(hours=2)) is None


def test_forecast_at_refuses_a_time_off_the_hour():
    forecast = Forecast(START, (Decimal(1),), (Decimal(0),), (Decimal(0),))
    with pytest.raises(ValueError):
        forecast.at(START + timedelta(minutes=30))


def test_one_location_is_an_object_not_a_list(serve):
    shapes = []

    def handler(request):
        response = openmeteo_answer(request)
        shapes.append(type(response.json()))
        return response

    serve(Provider.OPENMETEO, handler)
    assert len(openmeteo.fetch(POINTS[:1], NOW)) == 1
    assert shapes == [dict]


def edited_answer(request, edit):
    data = openmeteo_answer(request).json()
    data = [data] if isinstance(data, dict) else data
    edit(data)
    return httpx.Response(200, json=data)


def test_a_null_inside_the_window_is_unavailable(serve):
    def edit(data):
        data[1]["hourly"]["wind_speed_10m"][100] = None

    serve(Provider.OPENMETEO, lambda r: edited_answer(r, edit))
    with pytest.raises(ProviderUnavailable) as caught:
        openmeteo.fetch(POINTS, NOW)
    assert caught.value.service == Service.WEATHER


@pytest.mark.parametrize("name", ["rain", "showers", "snowfall"])
def test_a_null_in_any_value_inside_the_window_is_unavailable(serve, name):
    def edit(data):
        data[0]["hourly"][name][5] = None

    serve(Provider.OPENMETEO, lambda r: edited_answer(r, edit))
    with pytest.raises(ProviderUnavailable):
        openmeteo.fetch(POINTS, NOW)


def test_the_window_ends_one_hour_after_now_plus_240_hours(serve):
    # The last hour in the window is NOW + 241 h = series index 251.
    def edit(data):
        data[0]["hourly"]["rain"][251] = None

    serve(Provider.OPENMETEO, lambda r: edited_answer(r, edit))
    with pytest.raises(ProviderUnavailable):
        openmeteo.fetch(POINTS, NOW)


def test_a_null_after_the_window_is_kept_as_none(serve):
    def edit(data):
        data[0]["hourly"]["rain"][252] = None

    serve(Provider.OPENMETEO, lambda r: edited_answer(r, edit))
    forecast = openmeteo.fetch(POINTS, NOW)[0]
    assert forecast.rain_in[252] is None
    assert forecast.at(START + timedelta(hours=252)) is None
    assert forecast.at(START + timedelta(hours=251)) is not None


def test_250_points_make_3_requests_with_100_100_50_locations(meteo):
    points = [(30 + i / 100, -90.0) for i in range(250)]
    forecasts = openmeteo.fetch(points, NOW)
    assert len(forecasts) == 250
    sizes = sorted(len(r.url.params["latitude"].split(",")) for r in meteo)
    assert sizes == [50, OPENMETEO_BATCH_SIZE, OPENMETEO_BATCH_SIZE]


def test_forecasts_come_back_in_the_order_of_the_points(serve):
    # Each answer marks its series with the latitude it was asked for, in the first hour.
    def handler(request):
        lats = request.url.params["latitude"].split(",")

        def edit(data):
            for series, lat in zip(data, lats, strict=True):
                series["hourly"]["wind_speed_10m"][0] = float(lat)

        return edited_answer(request, edit)

    serve(Provider.OPENMETEO, handler)
    points = [(30 + i / 100, -90.0) for i in range(250)]
    forecasts = openmeteo.fetch(points, NOW)
    for i, (lat, _) in enumerate(points):
        assert forecasts[i].wind_mph[0] == Decimal(f"{lat:.4f}")


def test_at_most_6_requests_run_at_once(serve):
    active = peak = 0

    async def handler(request):
        nonlocal active, peak
        active += 1
        peak = max(peak, active)
        await asyncio.sleep(0.02)
        active -= 1
        return openmeteo_answer(request)

    serve(Provider.OPENMETEO, handler)
    points = [(30 + i / 1000, -90.0) for i in range(100 * 9)]
    assert len(openmeteo.fetch(points, NOW)) == 900
    assert peak == OPENMETEO_MAX_CONCURRENT


def test_a_timeout_is_unavailable(serve):
    def handler(request):
        raise httpx.ReadTimeout("slow")

    serve(Provider.OPENMETEO, handler)
    with pytest.raises(ProviderUnavailable) as caught:
        openmeteo.fetch(POINTS, NOW)
    assert caught.value.service == Service.WEATHER


@pytest.mark.parametrize("status", [429, 500, 503, 400])
def test_a_bad_status_is_unavailable(serve, status):
    serve(Provider.OPENMETEO, lambda r: httpx.Response(status, text="nope"))
    with pytest.raises(ProviderUnavailable):
        openmeteo.fetch(POINTS, NOW)


@pytest.mark.parametrize(
    "body",
    [b"not json", b"{}", b"[]", b'{"hourly": 3}', b'[{"hourly": {"time": []}}]'],
)
def test_an_invalid_answer_is_unavailable(serve, body):
    serve(Provider.OPENMETEO, lambda r: httpx.Response(200, content=body))
    with pytest.raises(ProviderUnavailable):
        openmeteo.fetch(POINTS, NOW)


def test_the_wrong_number_of_answers_is_unavailable(serve):
    def handler(request):
        return httpx.Response(200, json=openmeteo_answer(request).json()[:2])

    serve(Provider.OPENMETEO, handler)
    with pytest.raises(ProviderUnavailable):
        openmeteo.fetch(POINTS, NOW)


def test_unequal_array_lengths_are_unavailable(serve):
    def edit(data):
        data[0]["hourly"]["snowfall"].pop()

    serve(Provider.OPENMETEO, lambda r: edited_answer(r, edit))
    with pytest.raises(ProviderUnavailable):
        openmeteo.fetch(POINTS, NOW)


def test_hours_that_are_not_consecutive_are_unavailable(serve):
    def edit(data):
        data[0]["hourly"]["time"][5] = data[0]["hourly"]["time"][6]

    serve(Provider.OPENMETEO, lambda r: edited_answer(r, edit))
    with pytest.raises(ProviderUnavailable):
        openmeteo.fetch(POINTS, NOW)


def test_batches_report_which_failed_and_which_were_refused_with_429(serve):
    def handler(request):
        first_lat = request.url.params["latitude"].split(",")[0]
        if first_lat == "31.0000":
            return httpx.Response(429)
        if first_lat == "32.0000":
            return httpx.Response(500)
        return openmeteo_answer(request)

    serve(Provider.OPENMETEO, handler)
    points = [(30 + i / 100, -90.0) for i in range(100 + 100 + 70 + 100)]
    outcomes = openmeteo.fetch_batches(points, NOW)
    assert [(o.start, o.size) for o in outcomes] == [(0, 100), (100, 100), (200, 100), (300, 70)]
    assert [o.forecasts is not None for o in outcomes] == [True, False, False, True]
    assert [o.rate_limited for o in outcomes] == [False, True, False, False]
    assert len(outcomes[0].forecasts) == 100


def test_one_bad_location_costs_only_itself(serve):
    def edit(data):
        data[1]["hourly"]["wind_speed_10m"][100] = None

    serve(Provider.OPENMETEO, lambda r: edited_answer(r, edit))
    (outcome,) = openmeteo.fetch_batches(POINTS, NOW)
    first, second, third = outcome.forecasts
    assert first is not None and third is not None
    assert second is None
    assert not outcome.rate_limited


def test_a_stalled_request_ends_at_the_total_time_limit(serve, monkeypatch):
    async def handler(request):
        await asyncio.sleep(5)

    monkeypatch.setattr(openmeteo, "OPENMETEO_TIMEOUT_S", 0.05)
    serve(Provider.OPENMETEO, handler)
    started = time.monotonic()
    with pytest.raises(ProviderUnavailable) as caught:
        openmeteo.fetch(POINTS, NOW)
    assert caught.value.service == Service.WEATHER
    assert time.monotonic() - started < 2


def test_any_error_in_one_batch_keeps_the_batches_that_arrived(serve):
    def handler(request):
        if request.url.params["latitude"].split(",")[0] == "31.0000":
            raise RuntimeError("not an httpx error")
        return openmeteo_answer(request)

    serve(Provider.OPENMETEO, handler)
    points = [(30 + i / 100, -90.0) for i in range(300)]
    outcomes = openmeteo.fetch_batches(points, NOW)
    assert [o.forecasts is not None for o in outcomes] == [True, False, True]
    assert not outcomes[1].rate_limited


def test_a_bad_location_is_logged_without_coordinates(serve, caplog):
    def edit(data):
        data[1]["hourly"]["wind_speed_10m"][100] = None

    serve(Provider.OPENMETEO, lambda r: edited_answer(r, edit))
    caplog.set_level(logging.WARNING)
    openmeteo.fetch_batches(POINTS, NOW)
    (record,) = caplog.records
    message = record.getMessage()
    assert "null in window" in message
    assert "position 1" in message and "batch from point 0" in message
    assert "41.9" not in message and "-87.6" not in message


def test_a_failed_request_is_logged_with_the_error_type_only(serve, caplog):
    def handler(request):
        raise RuntimeError(f"secret detail {request.url}")

    serve(Provider.OPENMETEO, handler)
    caplog.set_level(logging.WARNING)
    with pytest.raises(ProviderUnavailable):
        openmeteo.fetch(POINTS, NOW)
    (record,) = caplog.records
    assert "error=RuntimeError" in record.getMessage()
    assert "secret detail" not in caplog.text
    assert record.exc_info is None


def test_a_bad_status_is_logged_with_the_status(serve, caplog):
    serve(Provider.OPENMETEO, lambda r: httpx.Response(429))
    caplog.set_level(logging.WARNING)
    openmeteo.fetch_batches(POINTS, NOW)
    (record,) = caplog.records
    assert "status=429" in record.getMessage()
