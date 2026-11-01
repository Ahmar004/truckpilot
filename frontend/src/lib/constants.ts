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

/** Forecast slider (design 8.5): hours, key jump, and the tick labels (12 and 36 hide on phones). */
export const SLIDER_MAX_HOUR = 48
export const SLIDER_PAGE_HOURS = 6
export const SLIDER_TICKS = [
  { hour: 0, phoneHidden: false },
  { hour: 6, phoneHidden: false },
  { hour: 12, phoneHidden: true },
  { hour: 24, phoneHidden: false },
  { hour: 36, phoneHidden: true },
  { hour: 48, phoneHidden: false },
] as const
export const NO_FORECAST_HOUR_LABEL = 'No forecast for this hour'
/** Length of the HOS rest shown in the truck text (spec 7.3). */
export const HOS_REST_HOURS = 10
/** Space the slider takes above the map's bottom edge on a phone, so the controls stay clear, in px. */
export const SLIDER_CLEARANCE_PX = 112

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

/** How a provider is named in messages (design 8.6). */
export const PROVIDER_SERVICE_NAME: Record<ProviderService, string> = {
  routing: 'Routing service',
  places: 'Place search',
  weather: 'Weather service',
}

/** Heatmap hours in a plan: hour 0 = departure, 49 values. */
export const HEATMAP_HOURS = 49

/** Browser routes (React Router paths). */
export const ROUTE_PATH = {
  HOME: '/',
  SIGN_IN: '/sign-in',
  PLAN: '/plan',
  PRIVACY: '/privacy',
} as const

/** Query string flag the sign-in page reads after a session ended (design F12). */
export const SESSION_ENDED_PARAM = 'ended'
export const SESSION_ENDED_VALUE = '1'

export const GOOGLE_SCRIPT_URL = 'https://accounts.google.com/gsi/client'

export const GOOGLE_BUTTON_STATUS = {
  LOADING: 'loading',
  READY: 'ready',
  FAILED: 'failed',
} as const
export type GoogleButtonStatus = (typeof GOOGLE_BUTTON_STATUS)[keyof typeof GOOGLE_BUTTON_STATUS]

/** Google button width in px; also the skeleton width so nothing shifts. */
export const GOOGLE_BUTTON_WIDTH = 280

/** API paths for sign-in and account. */
export const AUTH_PATH = {
  ME: '/api/me',
  GOOGLE: '/api/auth/google',
  SIGN_OUT: '/api/auth/sign-out',
  DELETE_ACCOUNT: '/api/account/delete',
} as const

/** What the planner screen is doing (architecture 12.4, design 8.6). */
export const PLANNER_STATUS = {
  EMPTY: 'empty',
  PLANNING: 'planning',
  RESULTS: 'results',
  UPDATING: 'updating',
  ERROR: 'error',
  NO_ROUTE: 'no_route',
  LIMITED: 'limited',
} as const
export type PlannerStatus = (typeof PLANNER_STATUS)[keyof typeof PLANNER_STATUS]

/** Bottom sheet heights and panel tabs (architecture 12.4). */
export const SHEET = { PEEK: 'peek', HALF: 'half', FULL: 'full' } as const
export type SheetHeight = (typeof SHEET)[keyof typeof SHEET]
export const PLANNER_TAB = { ROUTES: 'routes', CHECKPOINTS: 'checkpoints' } as const
export type PlannerTab = (typeof PLANNER_TAB)[keyof typeof PLANNER_TAB]

/** Planner API paths. */
export const PLANNER_PATH = {
  PLANS: '/api/plans',
  PLACES: '/api/places',
  UPDATE: '/api/plans/update',
} as const

/** Place search: shortest query, pause before a request (design 4.2). */
export const PLACE_QUERY_MIN = 2
export const PLACE_SEARCH_DEBOUNCE_MS = 250

/** Field names the form shows errors under. */
export const TRIP_FIELD = {
  ORIGIN: 'origin',
  DESTINATION: 'destination',
  DEPARTURE: 'departure',
  LOAD: 'load',
} as const
export type TripField = (typeof TRIP_FIELD)[keyof typeof TRIP_FIELD]

/** Wall-clock minutes between suggested departure times (design 4.2). */
export const DEPARTURE_STEP_MIN = 15

/** Phone below this width, side panel from it (design 8.1). */
export const DESKTOP_QUERY = '(min-width: 48rem)'

/** Space the floating header takes at the top of the map, in px (header pill plus its margin). */
export const MAP_TOP_PADDING_PX = 72
/** Drag farther than this many px and a press on the sheet handle counts as a drag, not a tap. */
export const SHEET_DRAG_THRESHOLD_PX = 4

/** Route rank labels, index 0 = rank 1 (spec 9.4). */
export const ROUTE_RANK_LABELS = ['1st best', '2nd best', '3rd best'] as const

/** Risk level names as shown to the driver (design 3.2). */
export const RISK_LABEL: Record<RiskLevel, string> = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  severe: 'Severe',
  no_travel: 'No Travel',
}

/** Shown for a Checkpoint whose forecast is past the Forecast window (spec 8.5). */
export const NO_WEATHER_LABEL = 'No weather data'
export const NO_WEATHER_DETAIL = 'No weather data (more than 10 days ahead from now)'

/** Order causes are named in: "wind, rain and snow". */
export const CAUSE_ORDER: readonly Cause[] = [CAUSE.WIND, CAUSE.RAIN, CAUSE.SNOW]

/** Where a Checkpoint was opened from, so Esc can return focus there. */
export const CHECKPOINT_SOURCE = { ROW: 'row', MAP: 'map' } as const
export type CheckpointSource = (typeof CHECKPOINT_SOURCE)[keyof typeof CHECKPOINT_SOURCE]

/** Attribute that marks a Checkpoint row, for returning focus to it. */
export const CHECKPOINT_ROW_ATTR = 'data-checkpoint-row'

/** A Checkpoint closer than this to the edge of the visible map area is panned into view, in px. */
export const CHECKPOINT_PAN_MARGIN_PX = 40
/** Extra clearance above a Checkpoint on desktop, so its pop-up fits, in px. */
export const CHECKPOINT_POPUP_CLEARANCE_PX = 240

/** Anchor ids on the landing page (design 6). */
export const SECTION_ID = {
  HOW_IT_WORKS: 'how-it-works',
  INSIDE_THE_PLANNER: 'inside-the-planner',
  RISK_LEVELS: 'risk-levels',
  FAQ: 'faq',
} as const

/** The data providers named in the footer (design 6 section 10), each linked to its own site. */
export const PROVIDER_LINKS = [
  { name: 'TomTom', href: 'https://www.tomtom.com/' },
  { name: 'Geoapify', href: 'https://www.geoapify.com/' },
  { name: 'Open-Meteo', href: 'https://open-meteo.com/' },
  { name: 'OpenFreeMap', href: 'https://openfreemap.org/' },
  { name: 'OpenStreetMap', href: 'https://www.openstreetmap.org/copyright' },
] as const

/** Where privacy questions go (design 9.1). */
export const CONTACT_EMAIL = 'ahmarali2004@gmail.com'
