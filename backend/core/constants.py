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


class UsageKind(StrEnum):
    """What a usage event counts toward a user's limits (spec 4)."""

    PLAN = "plan"
    UPDATE = "update"
    SEARCH = "search"


class Service(StrEnum):
    """The service name a provider error carries; the browser writes the copy (spec 11)."""

    ROUTING = "routing"
    PLACES = "places"
    WEATHER = "weather"


class Provider(StrEnum):
    """An external provider, with its app-wide daily budget and error service name."""

    TOMTOM = "tomtom"
    GEOAPIFY = "geoapify"
    OPENMETEO = "openmeteo"

    @property
    def daily_budget(self) -> int:
        return PROVIDER_DAILY_BUDGET[self]

    @property
    def service(self) -> Service:
        return PROVIDER_SERVICE[self]


# Calls per UTC day for the whole app (tech-stack 12a).
PROVIDER_DAILY_BUDGET = {
    Provider.TOMTOM: 650,
    Provider.GEOAPIFY: 2_900,
    Provider.OPENMETEO: 9_500,
}
PROVIDER_SERVICE = {
    Provider.TOMTOM: Service.ROUTING,
    Provider.GEOAPIFY: Service.PLACES,
    Provider.OPENMETEO: Service.WEATHER,
}

# Per-user limits (spec 4). "Per day" is a rolling 24 h.
PLANS_PER_HOUR = 30
PLANS_PER_DAY = 100
UPDATES_PER_HOUR = 120
SEARCHES_PER_HOUR = 300
HOUR_WINDOW_MIN = 60
DAY_WINDOW_MIN = 24 * 60

# Clean-up (architecture 3): usage events are kept 24 h, provider_day rows 2 days.
USAGE_EVENT_KEEP_H = 24
PROVIDER_DAY_KEEP_DAYS = 2


class ErrorCode(StrEnum):
    """Every API error code (architecture 4.2)."""

    NOT_SIGNED_IN = "not_signed_in"
    SIGN_IN_FAILED = "sign_in_failed"
    CSRF_FAILED = "csrf_failed"
    INVALID_INPUT = "invalid_input"
    SAME_PLACE = "same_place"
    DEPARTURE_PASSED = "departure_passed"
    INVALID_BUNDLE = "invalid_bundle"
    RATE_LIMITED = "rate_limited"
    SEARCH_LIMITED = "search_limited"
    PROVIDER_BUDGET = "provider_budget"
    PROVIDER_UNAVAILABLE = "provider_unavailable"
    NO_ROUTE = "no_route"


class FieldCode(StrEnum):
    """Short code for a field that failed validation, in `fields` of `invalid_input`."""

    REQUIRED = "required"
    INVALID = "invalid"
    PICK_PLACE = "pick_place"
    LOAD_RANGE = "load_range"


# The fixed user the E2E_MODE test sign-in uses (architecture 13).
E2E_USER_SUB = "e2e-test-user"
E2E_USER_NAME = "Test Driver"
E2E_USER_EMAIL = "test.driver@example.com"

# Seconds to wait when fetching Google's public certificates (architecture 5).
GOOGLE_CERT_TIMEOUT_S = 5

# Provider calls (architecture 5, 6.4, 6.8, 8). Timeouts are seconds per call.
TOMTOM_TIMEOUT_S = 8
OPENMETEO_TIMEOUT_S = 6
GEOAPIFY_TIMEOUT_S = 3
# TomTom allows about 5 calls a second per key; a 429 waits this long (a random time in the
# range) and retries once.
TOMTOM_RETRY_WAIT_MIN_S = 0.3
TOMTOM_RETRY_WAIT_MAX_S = 0.6
# The main routing call asks for the best route plus this many alternatives (spec 6.1).
MAIN_MAX_ALTERNATIVES = 2
KG_PER_LB = Decimal("0.45359237")
GEOAPIFY_LIMIT = 5
GEOAPIFY_COUNTRY_CODES = ("us", "ca")

# Open-Meteo: locations per request, requests at once, and days of hourly data asked for
# (12 days cover now + 240 h plus the rounding at any time of day).
OPENMETEO_BATCH_SIZE = 100
OPENMETEO_MAX_CONCURRENT = 6
FORECAST_DAYS = 12
# A cached forecast cell is fresh for this long (tech-stack 12).
FORECAST_FRESH_H = 1

# Forecast cell sizes in degrees: Checkpoints use the first; the heatmap picks one of the rest
# (architecture 6.5).
CELL_DEG_CHECKPOINT = Decimal("0.1")
CELL_DEGS_HEATMAP = (Decimal("0.5"), Decimal("1.0"), Decimal("2.0"))

# Provider endpoints (request shapes from each provider docs, see docs/api-setup-guide.md).
TOMTOM_ROUTING_URL = "https://api.tomtom.com/routing/1/calculateRoute"
GEOAPIFY_AUTOCOMPLETE_URL = "https://api.geoapify.com/v1/geocode/autocomplete"
OPENMETEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

# Detour round (architecture 6.4, spec 6.2). Waypoints sit at these shares of the straight
# origin-to-destination distance, left then right of the halfway point of the fastest route.
DETOUR_OFFSETS = (0.15, 0.30)
# Each Waypoint call asks for the best route plus this many alternatives.
DETOUR_MAX_ALTERNATIVES = 1
# Ladder steps: (max driving time as a multiple of the fastest route's, max shared road share).
LADDER_STEPS = ((1.25, 0.50), (1.50, 0.70), (2.00, 0.90))
# Shared-road and backtrack tests sample a track every SAMPLE_STEP_M and call a sample matched
# when it is within MATCH_M of the road it is compared with.
SAMPLE_STEP_M = 100
MATCH_M = 25
# A sample doubles back when it matches the same track more than DOUBLED_BACK_M earlier along
# it; a track backtracks when more than DOUBLED_BACK_M of samples in a row double back.
DOUBLED_BACK_M = 1000

# IANA zones of the US and Canada, from zone.tab of tzdata 2026f (the `US` and `CA` rows). A
# Waypoint whose time zone is not here (the sea gives Etc/..., Mexico gives America/Mexico_City
# and others) is dropped before any call.
US_CANADA_ZONES = frozenset(
    {
        "America/Adak",
        "America/Anchorage",
        "America/Atikokan",
        "America/Blanc-Sablon",
        "America/Boise",
        "America/Cambridge_Bay",
        "America/Chicago",
        "America/Creston",
        "America/Dawson",
        "America/Dawson_Creek",
        "America/Denver",
        "America/Detroit",
        "America/Edmonton",
        "America/Fort_Nelson",
        "America/Glace_Bay",
        "America/Goose_Bay",
        "America/Halifax",
        "America/Indiana/Indianapolis",
        "America/Indiana/Knox",
        "America/Indiana/Marengo",
        "America/Indiana/Petersburg",
        "America/Indiana/Tell_City",
        "America/Indiana/Vevay",
        "America/Indiana/Vincennes",
        "America/Indiana/Winamac",
        "America/Inuvik",
        "America/Iqaluit",
        "America/Juneau",
        "America/Kentucky/Louisville",
        "America/Kentucky/Monticello",
        "America/Los_Angeles",
        "America/Menominee",
        "America/Metlakatla",
        "America/Moncton",
        "America/New_York",
        "America/Nome",
        "America/North_Dakota/Beulah",
        "America/North_Dakota/Center",
        "America/North_Dakota/New_Salem",
        "America/Phoenix",
        "America/Rankin_Inlet",
        "America/Regina",
        "America/Resolute",
        "America/Sitka",
        "America/St_Johns",
        "America/Swift_Current",
        "America/Toronto",
        "America/Vancouver",
        "America/Whitehorse",
        "America/Winnipeg",
        "America/Yakutat",
        "Pacific/Honolulu",
    }
)

# Interval choices and the weather-location cap (architecture 6.5). Each plan uses at most
# MAX_WEATHER_LOCATIONS forecast locations.
INTERVAL_AUTO = "auto"
INTERVALS_MI = (INTERVAL_SHORT_MI, INTERVAL_MEDIUM_MI, INTERVAL_LONG_MI)
MAX_WEATHER_LOCATIONS = 500

# Heatmap (architecture 6.11): the corridor is sampled every CORRIDOR_SAMPLE_M metres; the
# slider shows hours 0 to 48, so HEATMAP_HOURS values per cell and per truck.
CORRIDOR_SAMPLE_M = 1000
HEATMAP_HOURS = 49
# The heatmap level string has one character per hour: the Level score, or this for no data.
LEVEL_NO_DATA_CHAR = "-"
# The cause bitmask of a heatmap cell and hour (architecture 4.1): one bit per Cause, plus a
# bit when a load rule raised the wind level.
CAUSE_BITS = {Cause.WIND: 1, Cause.RAIN: 2, Cause.SNOW: 4}
LOAD_RULE_BIT = 8


class LoadUnit(StrEnum):
    """The unit a driver typed the load in; the rules always run on pounds (spec 8.4)."""

    LB = "lb"
    KG = "kg"


class IntervalMode(StrEnum):
    """Whether the Interval was chosen by the app or by the driver (architecture 4.1)."""

    AUTO = "auto"
    FIXED = "fixed"


# Route bundle (architecture 6.13): the kept routes are simplified to this tolerance before
# they are signed, and the token carries this version so an old token is refused.
BUNDLE_SIMPLIFY_M = 20
BUNDLE_VERSION = 1
BUNDLE_SALT = "route-bundle"


# Plan input checks (spec 5, architecture 6.1). The load limits are whole numbers; the same
# place test is a distance in metres; a departure up to DEPARTURE_GRACE_S in the past still
# counts as now.
LOAD_MAX_LB = 80_000
LOAD_MAX_KG = 36_287
SAME_PLACE_M = 500
DEPARTURE_GRACE_S = 60

# Place search (architecture 7, 8): the query length the API accepts, and the salt of the
# signed place token.
PLACE_QUERY_MIN = 2
PLACE_QUERY_MAX = 100
PLACE_SALT = "place"
