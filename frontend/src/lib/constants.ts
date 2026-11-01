// Enum-like values shared across the app. Mirrors backend core/constants.py (architecture 4.1).

export const RISK_LEVEL = {
  LOW: 'low',
  MODERATE: 'moderate',
  HIGH: 'high',
  SEVERE: 'severe',
  NO_TRAVEL: 'no_travel',
} as const
export type RiskLevel = (typeof RISK_LEVEL)[keyof typeof RISK_LEVEL]

/** Risk levels from safest to worst. */
export const RISK_LEVELS_ORDERED: readonly RiskLevel[] = [
  RISK_LEVEL.LOW,
  RISK_LEVEL.MODERATE,
  RISK_LEVEL.HIGH,
  RISK_LEVEL.SEVERE,
  RISK_LEVEL.NO_TRAVEL,
]

/** Heatmap level codes: one character per hour, "0".."4" = Low..No Travel, "-" = no data. */
export const HEATMAP_LEVEL_CODE = {
  LOW: '0',
  MODERATE: '1',
  HIGH: '2',
  SEVERE: '3',
  NO_TRAVEL: '4',
  NO_DATA: '-',
} as const
export type HeatmapLevelCode = (typeof HEATMAP_LEVEL_CODE)[keyof typeof HEATMAP_LEVEL_CODE]

export const CAUSE = {
  WIND: 'wind',
  RAIN: 'rain',
  SNOW: 'snow',
} as const
export type Cause = (typeof CAUSE)[keyof typeof CAUSE]

/** Heatmap cause bitmask bits (architecture 4.1). */
export const CAUSE_BIT = {
  WIND: 1,
  RAIN: 2,
  SNOW: 4,
  LOAD_RULE: 8,
} as const

export const RECOMMENDATION = {
  RECOMMENDED: 'recommended',
  NOT_RECOMMENDED: 'not_recommended',
} as const
export type Recommendation = (typeof RECOMMENDATION)[keyof typeof RECOMMENDATION]

export const ROUTE_SOURCE = {
  API: 'api',
  DETOUR: 'detour',
} as const
export type RouteSource = (typeof ROUTE_SOURCE)[keyof typeof ROUTE_SOURCE]

export const TRUCK_STATUS = {
  DRIVING: 'driving',
  BREAK: 'break',
  REST: 'rest',
  ARRIVED: 'arrived',
} as const
export type TruckStatus = (typeof TRUCK_STATUS)[keyof typeof TRUCK_STATUS]

export const UNIT_SYSTEM = {
  IMPERIAL: 'imperial',
  METRIC: 'metric',
} as const
export type UnitSystem = (typeof UNIT_SYSTEM)[keyof typeof UNIT_SYSTEM]

export const LOAD_UNIT = {
  LB: 'lb',
  KG: 'kg',
} as const
export type LoadUnit = (typeof LOAD_UNIT)[keyof typeof LOAD_UNIT]

export const THEME = {
  LIGHT: 'light',
  DARK: 'dark',
} as const
export type Theme = (typeof THEME)[keyof typeof THEME]

/** Interval choices (spec 7.1): "auto" or a fixed number of miles. */
export const INTERVAL_AUTO = 'auto'
export const INTERVAL_MILES = [10, 25, 50] as const
export type IntervalMiles = (typeof INTERVAL_MILES)[number]
export type IntervalChoice = typeof INTERVAL_AUTO | IntervalMiles

export const INTERVAL_MODE = {
  AUTO: 'auto',
  FIXED: 'fixed',
} as const
export type IntervalMode = (typeof INTERVAL_MODE)[keyof typeof INTERVAL_MODE]

/** The only two things the app's own code stores in the browser (design 3.5). */
export const STORAGE_KEY = {
  UNITS: 'tp-units',
  THEME: 'tp-theme',
} as const

/** Error codes the server sends (architecture 4.2). */
export const ERROR_CODE = {
  NOT_SIGNED_IN: 'not_signed_in',
  SIGN_IN_FAILED: 'sign_in_failed',
  CSRF_FAILED: 'csrf_failed',
  INVALID_INPUT: 'invalid_input',
  SAME_PLACE: 'same_place',
  DEPARTURE_PASSED: 'departure_passed',
  INVALID_BUNDLE: 'invalid_bundle',
  RATE_LIMITED: 'rate_limited',
  SEARCH_LIMITED: 'search_limited',
  PROVIDER_BUDGET: 'provider_budget',
  PROVIDER_UNAVAILABLE: 'provider_unavailable',
  NO_ROUTE: 'no_route',
} as const
export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE]

/** Codes raised by the client itself, never sent by the server. */
export const CLIENT_ERROR_CODE = {
  NETWORK: 'network_error',
  TIMEOUT: 'timeout',
  BAD_RESPONSE: 'bad_response',
} as const
export type ClientErrorCode = (typeof CLIENT_ERROR_CODE)[keyof typeof CLIENT_ERROR_CODE]

export const PROVIDER_SERVICE = {
  ROUTING: 'routing',
  PLACES: 'places',
  WEATHER: 'weather',
} as const
export type ProviderService = (typeof PROVIDER_SERVICE)[keyof typeof PROVIDER_SERVICE]

/** Heatmap hours in a plan: hour 0 = departure, 49 values. */
export const HEATMAP_HOURS = 49
