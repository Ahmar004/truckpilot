"""Enum-like values and rule thresholds shared across the backend.

Nothing else in the backend writes these values inline.
"""

from decimal import Decimal
from enum import IntEnum, StrEnum


class Level(IntEnum):
    """Risk level. The integer value is the risk score (spec 9.2)."""

    LOW = 0
    MODERATE = 1
    HIGH = 2
    SEVERE = 3
    NO_TRAVEL = 4

    @property
    def code(self) -> str:
        return self.name.lower()


class Cause(StrEnum):
    """Weather condition that sets a Risk level. Declaration order is the reporting order."""

    WIND = "wind"
    RAIN = "rain"
    SNOW = "snow"


# Band edges (spec 8.2). A value exactly on a lower edge goes to the higher band.
WIND_MODERATE_MPH = Decimal("25")
WIND_HIGH_MPH = Decimal("35")
WIND_SEVERE_MPH = Decimal("45")
WIND_NO_TRAVEL_MPH = Decimal("55")

RAIN_MODERATE_IN_HR = Decimal("0.10")
RAIN_HIGH_IN_HR = Decimal("0.25")
RAIN_SEVERE_IN_HR = Decimal("0.50")
# Rain is No Travel only above this value (strict).
RAIN_NO_TRAVEL_ABOVE_IN_HR = Decimal("1.00")

SNOW_MODERATE_IN_HR = Decimal("0.5")
SNOW_HIGH_IN_HR = Decimal("1.0")
SNOW_SEVERE_IN_HR = Decimal("2.0")
# Snow is No Travel only above this value (strict).
SNOW_NO_TRAVEL_ABOVE_IN_HR = Decimal("3.0")

# Load rules (spec 8.3). They apply when the load is strictly above the value, in lb.
LOAD_RAISES_TO_SEVERE_ABOVE_LB = 40_000
LOAD_RAISES_TO_NO_TRAVEL_ABOVE_LB = 30_000

# Checkpoint interval choices in miles and the auto-interval rule (spec 7.1).
INTERVAL_SHORT_MI = 10
INTERVAL_MEDIUM_MI = 25
INTERVAL_LONG_MI = 50
# Under AUTO_SHORT_BELOW_MI: INTERVAL_SHORT_MI. From there to AUTO_LONG_ABOVE_MI, both
# included: INTERVAL_MEDIUM_MI. Over AUTO_LONG_ABOVE_MI: INTERVAL_LONG_MI.
AUTO_SHORT_BELOW_MI = 150
AUTO_LONG_ABOVE_MI = 600

# Units and geometry.
METERS_PER_MILE = 1609.344
SECONDS_PER_HOUR = 3600
EARTH_RADIUS_M = 6_371_008.8


class StopKind(StrEnum):
    """Kind of HOS Stop (spec 7.3)."""

    BREAK = "break"
    REST = "rest"


class TruckStatus(StrEnum):
    """What the truck is doing at a moment on the timeline."""

    DRIVING = "driving"
    BREAK = "break"
    REST = "rest"
    ARRIVED = "arrived"


class RouteSource(StrEnum):
    """Where a Route came from: the routing API, or built by the detour ladder."""

    API = "api"
    DETOUR = "detour"


# HOS (spec 7.3), in seconds: a break after 8 h of driving since the last break, lasting
# 30 min; a rest after 11 h of driving since the last rest, lasting 10 h.
HOS_BREAK_AFTER_DRIVE_S = 8 * SECONDS_PER_HOUR
HOS_BREAK_DURATION_S = 30 * 60
HOS_REST_AFTER_DRIVE_S = 11 * SECONDS_PER_HOUR
HOS_REST_DURATION_S = 10 * SECONDS_PER_HOUR

# Forecast window (spec 7.6): now + 10 days, in hours.
FORECAST_WINDOW_H = 240


class Recommendation(StrEnum):
    """Whether a ranked Route is the recommended one (spec 9.4)."""

    RECOMMENDED = "recommended"
    NOT_RECOMMENDED = "not_recommended"


# Routes kept after ranking (spec 9.4).
TOP_ROUTES = 3

# Comparison precision (spec 9.3): miles to 0.1, average risk to 0.01, travel time to the
# whole minute.
MILES_COMPARE_PRECISION = Decimal("0.1")
AVERAGE_RISK_PRECISION = Decimal("0.01")
TRAVEL_MINUTE_PRECISION = Decimal("1")
SECONDS_PER_MINUTE = 60
