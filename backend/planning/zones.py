"""The IANA time zone of a point, found offline with timezonefinder."""

from timezonefinder import TimezoneFinder

_finder: TimezoneFinder | None = None


def zone_at(lat: float, lon: float) -> str | None:
    """The zone name at a point, or None when no zone covers it."""
    global _finder
    if _finder is None:
        _finder = TimezoneFinder()
    return _finder.timezone_at(lng=lon, lat=lat)
