"""The risk engine: one rating for the weather at one Checkpoint (spec 8).

Pure business rules. The Checkpoint risk, the heatmap and the route ranking all call rate().
"""

from dataclasses import dataclass
from decimal import Decimal

from core.constants import (
    LOAD_RAISES_TO_NO_TRAVEL_ABOVE_LB,
    LOAD_RAISES_TO_SEVERE_ABOVE_LB,
    RAIN_HIGH_IN_HR,
    RAIN_MODERATE_IN_HR,
    RAIN_NO_TRAVEL_ABOVE_IN_HR,
    RAIN_SEVERE_IN_HR,
    SNOW_HIGH_IN_HR,
    SNOW_MODERATE_IN_HR,
    SNOW_NO_TRAVEL_ABOVE_IN_HR,
    SNOW_SEVERE_IN_HR,
    WIND_HIGH_MPH,
    WIND_MODERATE_MPH,
    WIND_NO_TRAVEL_MPH,
    WIND_SEVERE_MPH,
    Cause,
    Level,
)


@dataclass(frozen=True)
class Rating:
    level: Level
    causes: tuple[Cause, ...]
    load_rule: bool


def _wind_level(wind_mph: Decimal) -> Level:
    if wind_mph >= WIND_NO_TRAVEL_MPH:
        return Level.NO_TRAVEL
    if wind_mph >= WIND_SEVERE_MPH:
        return Level.SEVERE
    if wind_mph >= WIND_HIGH_MPH:
        return Level.HIGH
    if wind_mph >= WIND_MODERATE_MPH:
        return Level.MODERATE
    return Level.LOW


def _rain_level(rain_in: Decimal) -> Level:
    if rain_in > RAIN_NO_TRAVEL_ABOVE_IN_HR:
        return Level.NO_TRAVEL
    if rain_in >= RAIN_SEVERE_IN_HR:
        return Level.SEVERE
    if rain_in >= RAIN_HIGH_IN_HR:
        return Level.HIGH
    if rain_in >= RAIN_MODERATE_IN_HR:
        return Level.MODERATE
    return Level.LOW


def _snow_level(snow_in: Decimal) -> Level:
    if snow_in > SNOW_NO_TRAVEL_ABOVE_IN_HR:
        return Level.NO_TRAVEL
    if snow_in >= SNOW_SEVERE_IN_HR:
        return Level.SEVERE
    if snow_in >= SNOW_HIGH_IN_HR:
        return Level.HIGH
    if snow_in >= SNOW_MODERATE_IN_HR:
        return Level.MODERATE
    return Level.LOW


def _load_raised_wind_level(wind_level: Level, load_lb: int) -> Level:
    """Apply the load rules (spec 8.3). They only raise the wind level, never lower it."""
    if wind_level == Level.SEVERE and load_lb > LOAD_RAISES_TO_NO_TRAVEL_ABOVE_LB:
        return Level.NO_TRAVEL
    if wind_level == Level.HIGH and load_lb > LOAD_RAISES_TO_SEVERE_ABOVE_LB:
        return Level.SEVERE
    return wind_level


def rate(wind_mph: Decimal, rain_in: Decimal, snow_in: Decimal, load_lb: int) -> Rating:
    """Rate one Checkpoint's weather on imperial values, exactly as given (no rounding)."""
    band_wind_level = _wind_level(wind_mph)
    wind_level = _load_raised_wind_level(band_wind_level, load_lb)
    levels = {
        Cause.WIND: wind_level,
        Cause.RAIN: _rain_level(rain_in),
        Cause.SNOW: _snow_level(snow_in),
    }

    level = max(levels.values())
    if level == Level.LOW:
        return Rating(level=Level.LOW, causes=(), load_rule=False)

    causes = tuple(cause for cause, cause_level in levels.items() if cause_level == level)
    load_rule = wind_level > band_wind_level and Cause.WIND in causes
    return Rating(level=level, causes=causes, load_rule=load_rule)
