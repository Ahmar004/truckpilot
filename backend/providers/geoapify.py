"""Geoapify place search: autocomplete for the origin and destination fields (architecture 8).

The request URL holds the API key, so no error carries the URL, the response text or the httpx
exception that raised it.
"""

import asyncio
import logging
from dataclasses import dataclass

import httpx
from django.conf import settings
from pydantic import BaseModel, ValidationError

from core.constants import (
    GEOAPIFY_AUTOCOMPLETE_URL,
    GEOAPIFY_COUNTRY_CODES,
    GEOAPIFY_LIMIT,
    GEOAPIFY_TIMEOUT_S,
    Provider,
    Service,
)
from core.errors import ProviderUnavailable
from providers import transport
from usage import limits

logger = logging.getLogger(__name__)

# Geoapify writes the country out; the design shows "Chicago, IL, USA" (Canada stays as is).
LONG_US_NAME = "United States of America"
SHORT_US_NAME = "USA"


@dataclass(frozen=True)
class GeoPlace:
    id: str
    label: str
    lat: float
    lon: float


class _Result(BaseModel):
    place_id: str
    formatted: str
    lat: float
    lon: float
    country_code: str


class _Answer(BaseModel):
    # Each result is checked on its own below, so one odd result does not hide the others.
    results: list[dict]


def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        timeout=GEOAPIFY_TIMEOUT_S, transport=transport.transport_for(Provider.GEOAPIFY)
    )


async def _get(params: dict) -> httpx.Response | None:
    """The response, or None when the request could not be made or finished in time.

    The time limit covers the whole call, unlike httpx's own timeout, which is per phase. Any
    error becomes None so none can carry the URL (it holds the API key).
    """
    try:
        async with asyncio.timeout(GEOAPIFY_TIMEOUT_S), _client() as client:
            return await client.get(GEOAPIFY_AUTOCOMPLETE_URL, params=params)
    except Exception as exc:
        transport.log_failure(logger, Service.PLACES, exc)
        return None


def _label(formatted: str) -> str:
    if formatted.endswith(LONG_US_NAME):
        return formatted[: -len(LONG_US_NAME)] + SHORT_US_NAME
    return formatted


def autocomplete(q: str) -> list[GeoPlace]:
    """Up to 5 places in the US or Canada that match the text. Reserves one Geoapify call."""
    limits.reserve(Provider.GEOAPIFY, 1)
    params = {
        "text": q,
        "filter": "countrycode:" + ",".join(GEOAPIFY_COUNTRY_CODES),
        "limit": GEOAPIFY_LIMIT,
        "lang": "en",
        "format": "json",
        "apiKey": settings.GEOAPIFY_API_KEY,
    }
    response = asyncio.run(_get(params))
    answer = None
    if response is not None and response.status_code != httpx.codes.OK:
        transport.log_failure(logger, Service.PLACES, status=response.status_code)
    if response is not None and response.status_code == httpx.codes.OK:
        try:
            answer = _Answer.model_validate_json(response.content)
        except ValidationError:
            answer = None
    if answer is None:
        raise ProviderUnavailable(Service.PLACES)
    places = []
    for item in answer.results:
        try:
            result = _Result.model_validate(item)
        except ValidationError:
            continue
        if result.country_code.lower() not in GEOAPIFY_COUNTRY_CODES:
            continue
        places.append(
            GeoPlace(
                id=result.place_id,
                label=_label(result.formatted),
                lat=result.lat,
                lon=result.lon,
            )
        )
    return places
