"""Open-Meteo hourly forecasts (architecture 6.8, tech-stack 12).

`fetch_batches` asks for many places in batches of 100 locations, at most 6 requests at once,
and says which batches failed, so the cache can keep the ones that worked. `fetch` is the
all-or-nothing version. This module never touches the database; the budget is reserved by
`weather.cache`.
"""

import asyncio
import json
import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import httpx
from pydantic import BaseModel

from core.constants import (
    FORECAST_DAYS,
    FORECAST_WINDOW_H,
    OPENMETEO_BATCH_SIZE,
    OPENMETEO_FORECAST_URL,
    OPENMETEO_MAX_CONCURRENT,
    OPENMETEO_TIMEOUT_S,
    Provider,
    Service,
)
from core.errors import ProviderUnavailable
from providers import transport
from weather.forecast import HOUR, Forecast

logger = logging.getLogger(__name__)

HOURLY_VALUES = "wind_speed_10m,rain,showers,snowfall"
# Coordinates are sent with 4 decimals (about 10 m); the forecast grid is far coarser.
COORDINATE_FORMAT = "{:.4f}"


class _NullInWindow(ValueError):
    pass


class _Hourly(BaseModel):
    time: list[str]
    wind_speed_10m: list[Decimal | None]
    rain: list[Decimal | None]
    showers: list[Decimal | None]
    snowfall: list[Decimal | None]


class _Location(BaseModel):
    hourly: _Hourly


@dataclass(frozen=True)
class BatchOutcome:
    """One request's result, with one entry per location asked for.

    `forecasts` is None when the whole batch failed. Otherwise each entry is that location's
    Forecast, or None when its own series was bad (a null inside the window, uneven series), so
    one bad location never discards the others. `rate_limited` is True when Open-Meteo refused
    the batch with a 429, so it did not count the calls and the reservation can be given back.
    """

    start: int
    size: int
    forecasts: list[Forecast | None] | None
    rate_limited: bool = False


def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        timeout=OPENMETEO_TIMEOUT_S, transport=transport.transport_for(Provider.OPENMETEO)
    )


def _window_last_index(start: datetime, now_utc: datetime) -> int:
    """Index of the last hour in the forecast window: now + 240 h, plus an hour for rounding."""
    last = now_utc + timedelta(hours=FORECAST_WINDOW_H) + HOUR
    return (last - start) // HOUR


def _location_forecast(location: _Location, now_utc: datetime) -> Forecast:
    hourly = location.hourly
    count = len(hourly.time)
    series = (hourly.wind_speed_10m, hourly.rain, hourly.showers, hourly.snowfall)
    if count == 0 or any(len(s) != count for s in series):
        raise ValueError("series lengths differ")
    start = datetime.fromisoformat(hourly.time[0]).replace(tzinfo=UTC)
    for k, text in enumerate(hourly.time):
        if datetime.fromisoformat(text).replace(tzinfo=UTC) != start + k * HOUR:
            raise ValueError("hours are not consecutive")
    in_window = range(min(_window_last_index(start, now_utc) + 1, count))
    if any(s[k] is None for s in series for k in in_window):
        # A hole in the window is never filled in (Rule-10, architecture 6.8).
        raise _NullInWindow()
    rain = tuple(
        None if r is None or s is None else r + s
        for r, s in zip(hourly.rain, hourly.showers, strict=True)
    )
    return Forecast(
        start_utc=start,
        wind_mph=tuple(hourly.wind_speed_10m),
        rain_in=rain,
        snow_in=tuple(hourly.snowfall),
    )


def _checked(item: object, now_utc: datetime, start: int, position: int) -> Forecast | None:
    """One location's Forecast, or None when its series is not usable.

    `start` is the batch's first point index and `position` this location's place in the batch,
    for the log line (no coordinates).
    """
    try:
        return _location_forecast(_Location.model_validate(item), now_utc)
    except _NullInWindow:
        reason = "null in window"
    except Exception as exc:
        # Whatever else is wrong with this series (pydantic's ValidationError, a Decimal error),
        # it must cost only this location.
        reason = type(exc).__name__
    logger.warning(
        "%s location dropped: %s (batch from point %d, position %d)",
        Service.WEATHER,
        reason,
        start,
        position,
    )
    return None


def _parse(
    content: bytes, expected: int, now_utc: datetime, start: int
) -> list[Forecast | None] | None:
    """One entry per location in order, or None when the answer is not what was asked for."""
    try:
        # Decimal keeps 0.1 + 0.2 at exactly 0.3; floats could land on the wrong side of a band.
        data = json.loads(content, parse_float=Decimal)
    except Exception as exc:
        transport.log_failure(logger, Service.WEATHER, exc)
        return None
    if isinstance(data, dict):
        # One location comes back as an object, several as a list.
        data = [data]
    if not isinstance(data, list) or len(data) != expected:
        logger.warning(
            "%s batch from point %d unusable: wrong answer shape", Service.WEATHER, start
        )
        return None
    return [_checked(item, now_utc, start, k) for k, item in enumerate(data)]


async def _fetch_batch(
    client: httpx.AsyncClient,
    gate: asyncio.Semaphore,
    start: int,
    chunk: list[tuple[float, float]],
    now_utc: datetime,
) -> BatchOutcome:
    params = {
        "latitude": ",".join(COORDINATE_FORMAT.format(lat) for lat, _ in chunk),
        "longitude": ",".join(COORDINATE_FORMAT.format(lon) for _, lon in chunk),
        "hourly": HOURLY_VALUES,
        "wind_speed_unit": "mph",
        "precipitation_unit": "inch",
        "timezone": "GMT",
        "forecast_days": FORECAST_DAYS,
    }
    async with gate:
        try:
            # One time limit for the whole request, unlike httpx's own per-phase timeout. Any
            # error is a failed batch, so gather() never loses the batches that did arrive.
            async with asyncio.timeout(OPENMETEO_TIMEOUT_S):
                response = await client.get(OPENMETEO_FORECAST_URL, params=params)
        except Exception as exc:
            transport.log_failure(logger, Service.WEATHER, exc)
            response = None
    failed = BatchOutcome(start, len(chunk), None)
    if response is None:
        return failed
    if response.status_code != httpx.codes.OK:
        transport.log_failure(logger, Service.WEATHER, status=response.status_code)
    if response.status_code == httpx.codes.TOO_MANY_REQUESTS:
        return BatchOutcome(start, len(chunk), None, rate_limited=True)
    if response.status_code != httpx.codes.OK:
        return failed
    forecasts = _parse(response.content, len(chunk), now_utc, start)
    return BatchOutcome(start, len(chunk), forecasts) if forecasts is not None else failed


async def _fetch_all(points: list[tuple[float, float]], now_utc: datetime) -> list[BatchOutcome]:
    gate = asyncio.Semaphore(OPENMETEO_MAX_CONCURRENT)
    async with _client() as client:
        return list(
            await asyncio.gather(
                *(
                    _fetch_batch(client, gate, i, points[i : i + OPENMETEO_BATCH_SIZE], now_utc)
                    for i in range(0, len(points), OPENMETEO_BATCH_SIZE)
                )
            )
        )


def fetch_batches(points: list[tuple[float, float]], now_utc: datetime) -> list[BatchOutcome]:
    """Fetch forecasts for (lat, lon) points; one outcome per batch, in point order.

    `now_utc` starts the forecast window (spec 7.6). No budget is reserved here.
    """
    if not points:
        return []
    return asyncio.run(_fetch_all(points, now_utc))


def fetch(points: list[tuple[float, float]], now_utc: datetime) -> list[Forecast]:
    """One Forecast per point, in order. A failed batch or bad location is ProviderUnavailable."""
    forecasts: list[Forecast | None] = []
    for outcome in fetch_batches(points, now_utc):
        if outcome.forecasts is None:
            raise ProviderUnavailable(Service.WEATHER)
        forecasts.extend(outcome.forecasts)
    if None in forecasts:
        raise ProviderUnavailable(Service.WEATHER)
    return forecasts
