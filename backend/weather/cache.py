"""The shared forecast cache (architecture 6.8, tech-stack 12).

Every user's plan reads and fills the same rows in Neon Postgres. A row is fresh for an hour.
The database is only touched before and after the HTTP block in `openmeteo`, never inside it.
"""

from datetime import datetime, timedelta
from decimal import Decimal

from django.utils import timezone

from core.constants import (
    FORECAST_FRESH_H,
    OPENMETEO_BATCH_SIZE,
    Provider,
    Service,
)
from core.errors import ProviderUnavailable
from providers import openmeteo
from usage import limits
from weather.cells import cell_centre
from weather.forecast import Forecast
from weather.models import ForecastCell

_SERIES = ("wind_mph", "rain_in", "snow_in")


def _to_row(key: str, forecast: Forecast, fetched_at: datetime) -> ForecastCell:
    def text(series):
        return [None if v is None else str(v) for v in series]

    return ForecastCell(
        key=key,
        fetched_at=fetched_at,
        start_utc=forecast.start_utc,
        wind_mph=text(forecast.wind_mph),
        rain_in=text(forecast.rain_in),
        snow_in=text(forecast.snow_in),
    )


def _to_forecast(row: ForecastCell) -> Forecast:
    def values(series):
        return tuple(None if v is None else Decimal(v) for v in series)

    return Forecast(
        start_utc=row.start_utc,
        wind_mph=values(row.wind_mph),
        rain_in=values(row.rain_in),
        snow_in=values(row.snow_in),
    )


def get_forecasts(keys: list[str], now: datetime | None = None) -> dict[str, Forecast]:
    """The forecast of each cell key: fresh rows from the database, the rest from Open-Meteo.

    Deletes rows older than an hour first. Reserves one Open-Meteo call per missing key
    (ProviderBudget before any request). Each valid cell that arrives is saved even if another
    batch or cell fails, so a Retry only fetches what is still missing; a batch refused with a
    429 gives its reservation back. Raises ProviderUnavailable(weather) when any batch or cell
    failed.

    The cache reads its own clock (`now=None` is the real time; tests pass `now`). A cached row
    is shared by every user, so it never depends on a plan's `now`: one `now` serves the stale
    delete, the freshness test, `fetched_at`, the budget day and the forecast window.
    """
    now = now or timezone.now()
    keys = list(dict.fromkeys(keys))
    fresh_after = now - timedelta(hours=FORECAST_FRESH_H)
    ForecastCell.objects.filter(fetched_at__lte=fresh_after).delete()
    found = {
        row.key: _to_forecast(row)
        for row in ForecastCell.objects.filter(key__in=keys, fetched_at__gt=fresh_after)
    }
    missing = [key for key in keys if key not in found]
    if missing:
        found.update(_fetch_missing(missing, now))
    return {key: found[key] for key in keys}


def _fetch_missing(missing: list[str], now: datetime) -> dict[str, Forecast]:
    limits.reserve(Provider.OPENMETEO, len(missing), now=now)
    outcomes = openmeteo.fetch_batches([cell_centre(key) for key in missing], now)
    fetched: dict[str, Forecast] = {}
    refused = 0
    failed = False
    for outcome in outcomes:
        if outcome.forecasts is None:
            failed = True
            if outcome.rate_limited:
                refused += outcome.size
            continue
        batch_keys = missing[outcome.start : outcome.start + outcome.size]
        for key, forecast in zip(batch_keys, outcome.forecasts, strict=True):
            if forecast is None:
                # This cell's series was bad: it is not cached, and the plan fails. Open-Meteo
                # served it, so the reservation stays.
                failed = True
            else:
                fetched[key] = forecast
    if fetched:
        # Always in key order: two plans on one corridor in opposite directions would otherwise
        # lock the same rows in opposite orders and deadlock.
        ForecastCell.objects.bulk_create(
            [_to_row(key, forecast, now) for key, forecast in sorted(fetched.items())],
            batch_size=OPENMETEO_BATCH_SIZE,
            update_conflicts=True,
            unique_fields=["key"],
            update_fields=["fetched_at", "start_utc", *_SERIES],
        )
    if refused:
        # Open-Meteo did not serve these calls and did not count them.
        limits.release(Provider.OPENMETEO, refused, now=now)
    if failed:
        raise ProviderUnavailable(Service.WEATHER)
    return fetched
