// Display conversions and formats (design 8.7). The server's numbers are imperial; this is display only.
import { LOAD_UNIT, UNIT_SYSTEM } from './constants'
import type { LoadUnit, UnitSystem } from './constants'
import type { Load } from './types'

const KM_PER_MILE = 1.609344
const MM_PER_INCH = 25.4
const KG_PER_LB = 0.45359237

/** Largest load, by unit (design 4.2 LoadField). */
export const MAX_LOAD = { [LOAD_UNIT.LB]: 80_000, [LOAD_UNIT.KG]: 36_287 } as const

const fmt = (value: number, decimals: number) =>
  value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

const isMetric = (system: UnitSystem) => system === UNIT_SYSTEM.METRIC

export const milesToKm = (mi: number) => mi * KM_PER_MILE

/** Wind to 1 decimal: "24.6 mph" or "39.6 km/h". */
export function formatWind(mph: number, system: UnitSystem): string {
  return isMetric(system) ? `${fmt(mph * KM_PER_MILE, 1)} km/h` : `${fmt(mph, 1)} mph`
}

/** Rain or snow: 3 decimals in in/hr, 2 decimals in mm/hr. */
export function formatPrecip(inches: number, system: UnitSystem): string {
  return isMetric(system) ? `${fmt(inches * MM_PER_INCH, 2)} mm/hr` : `${fmt(inches, 3)} in/hr`
}

/** Whole distance: "412 mi" or "663 km". */
export function formatDistance(mi: number, system: UnitSystem): string {
  return isMetric(system)
    ? `${fmt(Math.round(milesToKm(mi)), 0)} km`
    : `${fmt(Math.round(mi), 0)} mi`
}

/** Risk miles to 1 decimal; a small non-zero amount reads "under 0.1 mi". */
export function formatRiskMiles(mi: number, system: UnitSystem): string {
  const unit = isMetric(system) ? 'km' : 'mi'
  const value = isMetric(system) ? milesToKm(mi) : mi
  if (mi > 0 && Math.round(value * 10) === 0) return `under 0.1 ${unit}`
  return `${fmt(value, 1)} ${unit}`
}

/** Mile marker as a whole number: "Mile 75" or "Km 121". */
export function formatMileMarker(mi: number, system: UnitSystem): string {
  return isMetric(system)
    ? `Km ${fmt(Math.round(milesToKm(mi)), 0)}`
    : `Mile ${fmt(Math.round(mi), 0)}`
}

/** Interval choice label: "25 mi" or "40 km". */
export function formatInterval(mi: number, system: UnitSystem): string {
  return isMetric(system) ? `${Math.round(milesToKm(mi))} km` : `${mi} mi`
}

export const loadUnitFor = (system: UnitSystem): LoadUnit =>
  isMetric(system) ? LOAD_UNIT.KG : LOAD_UNIT.LB

/**
 * The load shown in the field. The load keeps the value as typed: in the typed unit it is
 * shown as is; in the other unit it is the converted whole number (design 4.2).
 */
export function displayLoad(typed: Load, system: UnitSystem): Load {
  const unit = loadUnitFor(system)
  if (typed.unit === unit) return typed
  const value = unit === LOAD_UNIT.KG ? typed.value * KG_PER_LB : typed.value / KG_PER_LB
  return { value: Math.round(value), unit }
}

/** "42,000 lb" */
export function formatLoad(load: Load): string {
  return `${fmt(load.value, 0)} ${load.unit}`
}

/** Minutes as "14 h 5 min", "5 min" or "2 h" (spec 4 waits, travel times). */
export function formatDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}
