// Form checks that run before a request is sent (design 8.2). The server re-checks everything
// (spec 5); these only give the driver a fast, exact message. Wording lives here, once.
import { ERROR_CODE, LOAD_UNIT, TRIP_FIELD } from './constants'
import type { IntervalChoice, LoadUnit, TripField } from './constants'
import { nowInZone } from './time'
import type { Place } from './types'
import { MAX_LOAD } from './units'

/** The load as typed. `value` is null while the field is empty. */
export interface FormLoad {
  value: number | null
  unit: LoadUnit
}

export interface TripForm {
  origin: Place | null
  destination: Place | null
  /** Wall time in the origin's zone, "YYYY-MM-DDTHH:mm", or "" */
  departureLocal: string
  /** True once the driver has edited the departure; the default then stops overwriting it. */
  departureEdited: boolean
  load: FormLoad
  interval: IntervalChoice
  hos: boolean
}

export type TripErrors = Partial<Record<TripField, string>>

export const TRIP_ERROR_TEXT = {
  PICK_PLACE: 'Pick a place from the suggestions.',
  SAME_PLACE: 'Origin and destination are the same place.',
  DEPARTURE_PASSED: 'Departure time has passed. Pick a new time.',
  DEPARTURE_MISSING: 'Pick a departure time.',
} as const

export function loadErrorText(unit: LoadUnit): string {
  return `Enter a whole number from 0 to ${MAX_LOAD[unit].toLocaleString('en-US')} ${unit}.`
}

export function isLoadValid(load: FormLoad): boolean {
  const { value, unit } = load
  return value !== null && Number.isInteger(value) && value >= 0 && value <= MAX_LOAD[unit]
}

const samePlace = (a: Place, b: Place) =>
  a.token === b.token || a.label.trim().toLowerCase() === b.label.trim().toLowerCase()

/**
 * All the problems with a form. `displayUnit` is the unit the load field currently shows, so the
 * message names the unit the driver sees. A departure is compared with "now" in the origin's zone.
 */
export function validateTrip(
  form: TripForm,
  displayUnit: LoadUnit = LOAD_UNIT.LB,
  now: Date = new Date(),
): TripErrors {
  const errors: TripErrors = {}
  if (!form.origin) errors[TRIP_FIELD.ORIGIN] = TRIP_ERROR_TEXT.PICK_PLACE
  if (!form.destination) errors[TRIP_FIELD.DESTINATION] = TRIP_ERROR_TEXT.PICK_PLACE
  if (form.origin && form.destination && samePlace(form.origin, form.destination)) {
    errors[TRIP_FIELD.DESTINATION] = TRIP_ERROR_TEXT.SAME_PLACE
  }
  if (form.origin) {
    if (!form.departureLocal) {
      errors[TRIP_FIELD.DEPARTURE] = TRIP_ERROR_TEXT.DEPARTURE_MISSING
    } else if (form.departureLocal < nowInZone(form.origin.tz, now)) {
      errors[TRIP_FIELD.DEPARTURE] = TRIP_ERROR_TEXT.DEPARTURE_PASSED
    }
  }
  if (!isLoadValid(form.load)) errors[TRIP_FIELD.LOAD] = loadErrorText(displayUnit)
  return errors
}

/** Field errors the server sent (architecture 4.2), mapped to the form's fields. */
export function serverFieldErrors(
  code: string,
  fields: Record<string, string> | undefined,
  displayUnit: LoadUnit,
): TripErrors {
  const errors: TripErrors = {}
  if (code === ERROR_CODE.SAME_PLACE) errors[TRIP_FIELD.DESTINATION] = TRIP_ERROR_TEXT.SAME_PLACE
  if (code === ERROR_CODE.DEPARTURE_PASSED) {
    errors[TRIP_FIELD.DEPARTURE] = TRIP_ERROR_TEXT.DEPARTURE_PASSED
  }
  if (code === ERROR_CODE.INVALID_INPUT && fields) {
    if (fields.origin) errors[TRIP_FIELD.ORIGIN] = TRIP_ERROR_TEXT.PICK_PLACE
    if (fields.destination) errors[TRIP_FIELD.DESTINATION] = TRIP_ERROR_TEXT.PICK_PLACE
    if (fields.load) errors[TRIP_FIELD.LOAD] = loadErrorText(displayUnit)
    if (fields.departure_local) errors[TRIP_FIELD.DEPARTURE] = TRIP_ERROR_TEXT.DEPARTURE_MISSING
  }
  return errors
}
