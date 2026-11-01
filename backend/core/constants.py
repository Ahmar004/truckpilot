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
