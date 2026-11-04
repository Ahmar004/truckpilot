"""Saved real provider answers, served to the provider modules when E2E_MODE is on.

End-to-end tests drive the whole app without reaching TomTom, Geoapify or Open-Meteo. Nothing
here is made up: every answer is a saved real one (backend/tests/fixtures). Only the shape
adapts to the request: TomTom's routes are trimmed to the alternatives asked for, and
Open-Meteo's hours are shifted to start at the current hour. `providers.transport` uses this
module only when settings.E2E_MODE is on, and settings refuse E2E_MODE outside local DEBUG, so
production never reaches it.
"""

import copy
import gzip
import json
from datetime import UTC, datetime, timedelta
from difflib import SequenceMatcher
from functools import cache

import httpx
from django.conf import settings

from core.constants import Provider

TOMTOM_MAIN = "tomtom_chicago_dallas_truck_alt5.json.gz"
TOMTOM_WAYPOINT = "tomtom_chicago_dallas_waypoint_alt5.json.gz"
GEOAPIFY_ANSWERS = {"chicago": "geoapify_chicago.json", "toronto": "geoapify_toronto.json"}
GEOAPIFY_REVERSE = "geoapify_reverse_joliet.json"
OPENMETEO_ANSWERS = ("openmeteo_3_locations.json", "openmeteo_snow_3_locations.json")
OPENMETEO_TIME_FORMAT = "%Y-%m-%dT%H:%M"


@cache
def _fixture_bytes(name: str) -> bytes:
    data = (settings.BASE_DIR / "tests" / "fixtures" / name).read_bytes()
    return gzip.decompress(data) if name.endswith(".gz") else data


@cache
def _fixture(name: str):
    return json.loads(_fixture_bytes(name))


def _tomtom(request: httpx.Request) -> httpx.Response:
    # The path is .../calculateRoute/<origin>[:<waypoint>]:<destination>/json.
    stops = request.url.path.rsplit("/", 2)[-2].split(":")
    saved = _fixture(TOMTOM_WAYPOINT if len(stops) > 2 else TOMTOM_MAIN)
    keep = 1 + int(request.url.params.get("maxAlternatives", "0"))
    return httpx.Response(200, json={**saved, "routes": saved["routes"][:keep]})


def _geoapify(request: httpx.Request) -> httpx.Response:
    if request.url.path.endswith("/reverse"):
        return httpx.Response(200, content=_fixture_bytes(GEOAPIFY_REVERSE))
    text = request.url.params.get("text", "").lower()
    best = max(GEOAPIFY_ANSWERS, key=lambda name: SequenceMatcher(None, text, name).ratio())
    return httpx.Response(200, content=_fixture_bytes(GEOAPIFY_ANSWERS[best]))


def _saved_series() -> list[dict]:
    return [location for name in OPENMETEO_ANSWERS for location in _fixture(name)]


def _nearest(lat: float, lon: float) -> dict:
    # Plain degree distance is enough to pick the closest of 6 saved places.
    return min(
        _saved_series(),
        key=lambda s: (s["latitude"] - lat) ** 2 + (s["longitude"] - lon) ** 2,
    )


def _now() -> datetime:
    return datetime.now(UTC)


def _openmeteo(request: httpx.Request) -> httpx.Response:
    lats = [float(v) for v in request.url.params["latitude"].split(",")]
    lons = [float(v) for v in request.url.params["longitude"].split(",")]
    # Start at the current UTC hour, so the 264 saved hours always cover now + 241 h (the
    # window needs that, spec 7.6); starting at midnight would fall short after about 23:00.
    start = _now().replace(minute=0, second=0, microsecond=0)
    answers = []
    for lat, lon in zip(lats, lons, strict=True):
        answer = copy.deepcopy(_nearest(lat, lon))
        hours = len(answer["hourly"]["time"])
        answer["hourly"]["time"] = [
            (start + timedelta(hours=k)).strftime(OPENMETEO_TIME_FORMAT) for k in range(hours)
        ]
        answers.append(answer)
    # One location comes back as an object, several as a list, as the real API does.
    return httpx.Response(200, json=answers[0] if len(answers) == 1 else answers)


_HANDLERS = {
    Provider.TOMTOM: _tomtom,
    Provider.GEOAPIFY: _geoapify,
    Provider.OPENMETEO: _openmeteo,
}


def transport(provider: Provider) -> httpx.MockTransport:
    """A transport that answers the provider's calls from the saved real answers."""
    return httpx.MockTransport(_HANDLERS[provider])
