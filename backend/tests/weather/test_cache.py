from datetime import UTC, datetime, timedelta
from decimal import Decimal

import httpx
import pytest
from conftest import openmeteo_answer

from core.constants import CELL_DEG_CHECKPOINT, Provider, Service
from core.errors import ProviderBudget, ProviderUnavailable
from usage import limits
from usage.models import ProviderDay
from weather import cache
from weather.cells import cell_centre, cell_key
from weather.models import ForecastCell

pytestmark = pytest.mark.django_db

NOW = datetime(2026, 11, 1, 10, 0, tzinfo=UTC)


def keys_for(count: int, start_lat: float = 30.0) -> list[str]:
    """`count` Checkpoint cell keys, one per 0.1 degree of latitude going north."""
    return [cell_key(start_lat + i / 10, -90.0, CELL_DEG_CHECKPOINT) for i in range(count)]


def calls_today() -> int:
    day = ProviderDay.objects.filter(provider=Provider.OPENMETEO, day=NOW.date()).first()
    return day.calls if day else 0


def batch_sizes(requests) -> list[int]:
    return sorted(len(r.url.params["latitude"].split(",")) for r in requests)


@pytest.fixture
def meteo(serve):
    return serve(Provider.OPENMETEO, openmeteo_answer)


def test_missing_keys_are_fetched_at_their_cell_centres_and_cached(meteo):
    keys = keys_for(3)
    found = cache.get_forecasts(keys, NOW)
    assert list(found) == keys
    (request,) = meteo
    centres = [cell_centre(k) for k in keys]
    assert request.url.params["latitude"] == ",".join(f"{lat:.4f}" for lat, _ in centres)
    assert request.url.params["longitude"] == ",".join(f"{lon:.4f}" for _, lon in centres)
    assert ForecastCell.objects.count() == 3
    assert calls_today() == 3


def test_fresh_rows_are_read_without_any_http_call_or_reservation(meteo):
    keys = keys_for(3)
    first = cache.get_forecasts(keys, NOW)
    meteo.clear()
    second = cache.get_forecasts(keys, NOW + timedelta(minutes=59))
    assert meteo == []
    assert calls_today() == 3
    assert second == first


def test_values_come_back_from_the_database_as_exact_decimals(serve):
    def handler(request):
        hourly = {
            "time": [f"2026-11-01T{h:02d}:00" for h in range(24)],
            "wind_speed_10m": [0.1] * 24,
            "rain": [0.1] * 23 + [None],
            "showers": [0.2] * 23 + [None],
            "snowfall": [0.0] * 24,
        }
        return httpx.Response(200, json={"hourly": hourly})

    serve(Provider.OPENMETEO, handler)
    (key,) = keys_for(1)
    # The null is in the last hour of the day, which is after this window.
    far_now = datetime(2026, 10, 1, 0, 0, tzinfo=UTC)
    cache.get_forecasts([key], far_now)
    stored = cache.get_forecasts([key], far_now + timedelta(minutes=5))[key]
    assert stored.start_utc == datetime(2026, 11, 1, tzinfo=UTC)
    assert stored.rain_in[0] == Decimal("0.3")
    assert str(stored.rain_in[0]) == "0.3"
    assert stored.rain_in[23] is None
    assert stored.wind_mph[5] == Decimal("0.1")
    assert stored.snow_in[0] == Decimal("0.0")


def test_only_the_missing_keys_are_fetched_and_reserved(meteo):
    keys = keys_for(5)
    cache.get_forecasts(keys[:3], NOW)
    meteo.clear()
    found = cache.get_forecasts(keys, NOW + timedelta(minutes=10))
    assert list(found) == keys
    (request,) = meteo
    assert request.url.params["latitude"].count(",") == 1
    assert calls_today() == 5
    assert ForecastCell.objects.count() == 5


def test_a_key_asked_twice_is_fetched_once(meteo):
    key = keys_for(1)[0]
    found = cache.get_forecasts([key, key], NOW)
    assert list(found) == [key]
    assert batch_sizes(meteo) == [1]
    assert calls_today() == 1


def test_missing_keys_go_in_batches_of_100(meteo):
    keys = keys_for(250)
    found = cache.get_forecasts(keys, NOW)
    assert len(found) == 250
    assert batch_sizes(meteo) == [50, 100, 100]
    assert calls_today() == 250
    assert ForecastCell.objects.count() == 250


def test_a_successful_batch_is_saved_even_when_another_batch_fails(serve):
    keys = keys_for(250)
    fail_first_lat = f"{cell_centre(keys[100])[0]:.4f}"

    def handler(request):
        if request.url.params["latitude"].split(",")[0] == fail_first_lat:
            return httpx.Response(500)
        return openmeteo_answer(request)

    seen = serve(Provider.OPENMETEO, handler)
    with pytest.raises(ProviderUnavailable) as caught:
        cache.get_forecasts(keys, NOW)
    assert caught.value.service == Service.WEATHER
    saved = set(ForecastCell.objects.values_list("key", flat=True))
    assert saved == set(keys[:100]) | set(keys[200:])
    # A 500 was counted by Open-Meteo, so the reservation stays.
    assert calls_today() == 250

    # Retry fetches only what is missing.
    seen.clear()
    serve(Provider.OPENMETEO, openmeteo_answer)
    found = cache.get_forecasts(keys, NOW + timedelta(minutes=1))
    assert len(found) == 250
    assert batch_sizes(seen) == [100]
    assert calls_today() == 350


def test_a_429_batch_gives_its_reservation_back_and_the_rest_is_saved(serve):
    keys = keys_for(250)
    refused_first_lat = f"{cell_centre(keys[100])[0]:.4f}"

    def handler(request):
        if request.url.params["latitude"].split(",")[0] == refused_first_lat:
            return httpx.Response(429)
        return openmeteo_answer(request)

    serve(Provider.OPENMETEO, handler)
    with pytest.raises(ProviderUnavailable) as caught:
        cache.get_forecasts(keys, NOW)
    assert caught.value.service == Service.WEATHER
    assert calls_today() == 150
    assert ForecastCell.objects.count() == 150


def test_rows_older_than_an_hour_are_deleted_and_fetched_again(meteo):
    keys = keys_for(3)
    cache.get_forecasts(keys, NOW)
    meteo.clear()
    later = NOW + timedelta(hours=1, minutes=1)
    cache.get_forecasts(keys[:1], later)
    assert batch_sizes(meteo) == [1]
    # The 2 stale rows that were not asked for are gone too (one DELETE per call).
    assert list(ForecastCell.objects.values_list("key", flat=True)) == keys[:1]
    assert ForecastCell.objects.get(key=keys[0]).fetched_at == later


def test_a_row_exactly_one_hour_old_is_stale(meteo):
    keys = keys_for(1)
    cache.get_forecasts(keys, NOW)
    meteo.clear()
    cache.get_forecasts(keys, NOW + timedelta(hours=1))
    assert batch_sizes(meteo) == [1]


def test_a_budget_refusal_makes_no_http_call_and_saves_nothing(meteo):
    ProviderDay.objects.create(provider=Provider.OPENMETEO, day=NOW.date(), calls=9_499)
    with pytest.raises(ProviderBudget) as caught:
        cache.get_forecasts(keys_for(2), NOW)
    assert caught.value.service == Service.WEATHER
    assert meteo == []
    assert ForecastCell.objects.count() == 0
    assert calls_today() == 9_499


def test_the_reservation_is_made_before_any_http_call(serve, monkeypatch):
    order = []
    real_reserve = limits.reserve

    def reserve(provider, n, **kwargs):
        order.append(("reserve", provider, n))
        real_reserve(provider, n, **kwargs)

    def handler(request):
        order.append("http")
        return openmeteo_answer(request)

    monkeypatch.setattr(limits, "reserve", reserve)
    serve(Provider.OPENMETEO, handler)
    cache.get_forecasts(keys_for(3), NOW)
    assert order == [("reserve", Provider.OPENMETEO, 3), "http"]


def test_no_keys_means_no_reservation_and_no_http_call(meteo):
    assert cache.get_forecasts([], NOW) == {}
    assert meteo == []
    assert calls_today() == 0


def test_an_invalid_answer_saves_nothing_and_is_unavailable(serve):
    serve(Provider.OPENMETEO, lambda r: httpx.Response(200, text="not json"))
    with pytest.raises(ProviderUnavailable):
        cache.get_forecasts(keys_for(2), NOW)
    assert ForecastCell.objects.count() == 0


def test_a_bad_location_is_not_cached_but_the_valid_ones_in_its_batch_are(serve):
    keys = keys_for(3)

    def handler(request):
        data = openmeteo_answer(request).json()
        data[1]["hourly"]["wind_speed_10m"][100] = None
        return httpx.Response(200, json=data)

    serve(Provider.OPENMETEO, handler)
    with pytest.raises(ProviderUnavailable) as caught:
        cache.get_forecasts(keys, NOW)
    assert caught.value.service == Service.WEATHER
    assert set(ForecastCell.objects.values_list("key", flat=True)) == {keys[0], keys[2]}
    # Open-Meteo served all 3 locations, so nothing is given back.
    assert calls_today() == 3
