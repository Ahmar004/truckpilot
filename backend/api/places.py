"""Place search and the signed place token (architecture 8, 7).

The token is the only way a place reaches a plan: the server signs the Geoapify answer it
filtered to the US and Canada, and later trusts nothing but its own signature. The browser
never sends coordinates.
"""

import math
from zoneinfo import ZoneInfo

from django.core import signing
from django.http import HttpRequest
from ninja import Query, Router

from api.schemas import PlacesOut
from core.constants import (
    PLACE_QUERY_MAX,
    PLACE_QUERY_MIN,
    PLACE_SALT,
    ErrorCode,
    FieldCode,
)
from core.errors import ApiError
from planning import zones
from planning.plan import PlaceInfo
from providers import geoapify
from providers.geoapify import GeoPlace
from usage import limits

router = Router()


class BadPlace(Exception):
    """A place token that is missing, forged or not in the shape the server signs."""


def make_token(place: GeoPlace, tz: str) -> str:
    payload = {
        "id": place.id,
        "label": place.label,
        "lat": place.lat,
        "lon": place.lon,
        "tz": tz,
    }
    return signing.dumps(payload, salt=PLACE_SALT)


def _is_number(value: object) -> bool:
    return isinstance(value, int | float) and not isinstance(value, bool) and math.isfinite(value)


def read_token(token: str) -> tuple[str, PlaceInfo]:
    """The Geoapify place id and the place in a token. Raises BadPlace for anything else."""
    try:
        payload = signing.loads(token, salt=PLACE_SALT)
        place_id, label, lat, lon, tz = (payload[k] for k in ("id", "label", "lat", "lon", "tz"))
        if not isinstance(place_id, str) or not isinstance(label, str) or not isinstance(tz, str):
            raise ValueError("a place needs an id, a label and a zone")
        if not (_is_number(lat) and _is_number(lon)):
            raise ValueError("a place needs coordinates")
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            raise ValueError("coordinates out of range")
        ZoneInfo(tz)
    except (signing.BadSignature, ValueError, KeyError, TypeError, OSError):
        raise BadPlace() from None
    return place_id, PlaceInfo(label, float(lat), float(lon), tz)


@router.get("/places", response=PlacesOut)
def search_places(request: HttpRequest, q: Query[str]):
    text = q.strip()
    if not PLACE_QUERY_MIN <= len(text) <= PLACE_QUERY_MAX:
        raise ApiError(ErrorCode.INVALID_INPUT, 422, fields={"q": FieldCode.INVALID})
    limits.record_search(request.user)
    found = []
    for place in geoapify.autocomplete(text):
        tz = zones.zone_at(place.lat, place.lon)
        if tz is not None:
            found.append({"label": place.label, "tz": tz, "token": make_token(place, tz)})
    return {"places": found}
