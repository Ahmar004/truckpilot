// Shapes of the server's answers (docs/architecture.md 4.1 and 4.2),
// checked against src/test/fixtures/*.json.
import type {
  Cause,
  ClientErrorCode,
  ErrorCode,
  IntervalChoice,
  IntervalMiles,
  IntervalMode,
  LoadUnit,
  ProviderService,
  Recommendation,
  RiskLevel,
  RouteSource,
  TruckStatus,
} from './constants'

export interface SessionUser {
  name: string
  email: string
}

export interface Place {
  label: string
  tz: string
  token: string
}

export interface Load {
  value: number
  unit: LoadUnit
}

export interface PlanRequest {
  origin: string
  destination: string
  departure_local: string
  load: Load
  interval: IntervalChoice
  hos: boolean
}

export interface UpdateRequest {
  bundle: string
  interval: IntervalChoice
  hos: boolean
}

export interface TripPlace {
  label: string
  tz: string
}

export interface Trip {
  origin: TripPlace
  destination: TripPlace
  departure_utc: string
  load_lb: number
  load: Load
  hos: boolean
}

export interface IntervalOption {
  mi: IntervalMiles
  allowed: boolean
}

export interface IntervalInfo {
  mode: IntervalMode
  used_mi: number
  requested_mi: IntervalMiles | null
  options: IntervalOption[]
}

export interface Notices {
  fewer_routes: 2 | null
  do_not_travel: boolean
}

export interface RouteMiles {
  low: number
  moderate: number
  high: number
  severe: number
  no_travel: number
  no_data: number
}

export interface Weather {
  wind_mph: number
  rain_in: number
  snow_in: number
}

export interface Checkpoint {
  n: number
  mile: number
  of_mi: number
  lat: number
  lon: number
  covered_mi: number
  eta_utc: string
  tz: string
  forecast_utc: string
  /** null = No weather data */
  weather: Weather | null
  level: RiskLevel | null
  causes: Cause[]
  load_rule: boolean
}

export interface TruckPosition {
  lat: number
  lon: number
  mile: number
  status: TruckStatus
}

export interface Route {
  id: string
  rank: number
  recommendation: Recommendation | null
  source: RouteSource
  distance_mi: number
  driving_s: number
  travel_s: number
  arrival_utc: string
  arrival_tz: string
  miles: RouteMiles
  average_risk: number | null
  /** Encoded polyline, precision 5 */
  line: string
  checkpoints: Checkpoint[]
  /** 49 positions, one per heatmap hour */
  truck: TruckPosition[]
}

export interface HeatmapHour {
  utc: string
  in_window: boolean
}

export interface HeatmapCell {
  i: number
  j: number
  /** 49 characters, one per hour: "0".."4" = Low..No Travel, "-" = no data */
  lv: string
  /** 49 cause bitmasks */
  cz: number[]
}

export interface Heatmap {
  cell_deg: 0.5 | 1 | 2
  hours: HeatmapHour[]
  cells: HeatmapCell[]
}

export interface Plan {
  now_utc: string
  window_end_utc: string
  trip: Trip
  interval: IntervalInfo
  notices: Notices
  routes: Route[]
  heatmap: Heatmap | null
  bundle: string
}

/** The one error body the server sends (architecture 4.2). */
export interface ErrorBody {
  code: ErrorCode
  service?: ProviderService
  retry_after_min?: number
  fields?: Record<string, string>
}

export type ApiErrorCode = ErrorCode | ClientErrorCode
