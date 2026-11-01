import {
  CAUSE,
  CAUSE_BIT,
  HEATMAP_LEVEL_CODE,
  HOS_REST_HOURS,
  NO_FORECAST_HOUR_LABEL,
  NO_WEATHER_LABEL,
  RISK_LABEL,
  RISK_LEVELS_ORDERED,
  TRUCK_STATUS,
} from './constants'
import type { Cause, RiskLevel, UnitSystem } from './constants'
import { joinCauses } from './checkpointText'
import { formatTime } from './time'
import type { HeatmapCell, Plan, TruckPosition } from './types'
import { formatMileOf } from './units'

const HOUR_MS = 3_600_000
const LOAD_RULE_TEXT = 'raised by the load rule'

/** The risk level of a heatmap code ("0".."4"), or null for "-" (no data). */
export function levelOfCode(code: string): RiskLevel | null {
  if (code === HEATMAP_LEVEL_CODE.NO_DATA) return null
  return RISK_LEVELS_ORDERED[Number(code)] ?? null
}

/** UTC time of a heatmap hour; the plan's own list when present, else departure plus hours. */
export function hourUtc(plan: Plan, hour: number): string {
  const listed = plan.heatmap?.hours[hour]?.utc
  if (listed) return listed
  return new Date(Date.parse(plan.trip.departure_utc) + hour * HOUR_MS).toISOString()
}

/** "Wed, Nov 4 · 1:00 AM CST" for a Forecast hour, in the origin's zone. */
export function hourTime(plan: Plan, hour: number): string {
  return formatTime(hourUtc(plan, hour), plan.trip.origin.tz)
}

/** False when the hour is past the Forecast window. With no heatmap there is nothing to say. */
export function hourInWindow(plan: Plan, hour: number): boolean {
  return plan.heatmap?.hours[hour]?.in_window ?? true
}

function causesOf(mask: number): Cause[] {
  const out: Cause[] = []
  if (mask & CAUSE_BIT.WIND) out.push(CAUSE.WIND)
  if (mask & CAUSE_BIT.RAIN) out.push(CAUSE.RAIN)
  if (mask & CAUSE_BIT.SNOW) out.push(CAUSE.SNOW)
  return out
}

/** "Severe, set by wind · Wed, Nov 4 · 1:00 AM CST"; Low has no "set by"; "-" is No weather data. */
export function cellTooltipText(cell: HeatmapCell, plan: Plan, hour: number): string {
  const when = hourTime(plan, hour)
  const level = levelOfCode(cell.lv.charAt(hour))
  if (level === null) return `${NO_WEATHER_LABEL} · ${when}`
  const mask = cell.cz[hour] ?? 0
  const causes = causesOf(mask)
  const parts = [RISK_LABEL[level]]
  if (level !== RISK_LEVELS_ORDERED[0]) {
    if (causes.length > 0) parts.push(`set by ${joinCauses(causes)}`)
    if (mask & CAUSE_BIT.LOAD_RULE) parts.push(LOAD_RULE_TEXT)
  }
  return `${parts.join(', ')} · ${when}`
}

/** The truck's state for the slider's spoken value (design 8.5). */
export function truckText(truck: TruckPosition | undefined, ofMi: number, units: UnitSystem) {
  if (!truck) return ''
  if (truck.status === TRUCK_STATUS.ARRIVED) return 'Truck has arrived'
  const at = formatMileOf(truck.mile, ofMi, units).toLowerCase()
  if (truck.status === TRUCK_STATUS.REST) return `Truck on a ${HOS_REST_HOURS} h rest at ${at}`
  if (truck.status === TRUCK_STATUS.BREAK) return `Truck on a break at ${at}`
  return `Truck at ${at}`
}

/** "+12 h · Wed, Nov 4 · 1:00 AM CST", plus the past-window note. */
export function sliderValueText(plan: Plan, hour: number): string {
  const base = `+${hour} h · ${hourTime(plan, hour)}`
  return hourInWindow(plan, hour) ? base : `${base} · ${NO_FORECAST_HOUR_LABEL}`
}
