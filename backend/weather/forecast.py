"""A forecast for one place: hourly wind, rain and snow from a start hour (UTC)."""

from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal

HOUR = timedelta(hours=1)


@dataclass(frozen=True)
class Forecast:
    """Hour k of each series is the hour start_utc + k hours.

    wind_mph is the wind at that hour; rain_in and snow_in are the totals for the hour that
    ends at it (Open-Meteo's "preceding hour", architecture 6.7). A value that Open-Meteo did
    not give is None. All values are exact Decimals, never floats.
    """

    start_utc: datetime
    wind_mph: tuple[Decimal | None, ...]
    rain_in: tuple[Decimal | None, ...]
    snow_in: tuple[Decimal | None, ...]

    def at(self, hour_utc: datetime) -> tuple[Decimal, Decimal, Decimal] | None:
        """(wind, rain, snow) at a whole UTC hour, or None when it has no data.

        None when the hour is outside the series or any of its values is missing. An hour that
        is not a whole number of hours from the start is a mistake in the caller.
        """
        steps, rest = divmod(hour_utc - self.start_utc, HOUR)
        if rest:
            raise ValueError("hour_utc must be a whole number of hours from start_utc")
        if not 0 <= steps < len(self.wind_mph):
            return None
        values = (self.wind_mph[steps], self.rain_in[steps], self.snow_in[steps])
        if any(v is None for v in values):
            return None
        return values
