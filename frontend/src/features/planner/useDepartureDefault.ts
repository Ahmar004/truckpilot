import { useCallback } from 'react'
import { DEPARTURE_STEP_MIN } from '../../lib/constants'
import { nextQuarterHour } from '../../lib/time'

/**
 * The default departure for a zone: the next quarter hour there, as a `datetime-local` string
 * (design 4.2). Returns a function so the clock is read when an origin is picked, not on render.
 */
export function useDepartureDefault() {
  return useCallback(
    (timeZone: string | null): string | null =>
      timeZone ? nextQuarterHour(timeZone, new Date(), DEPARTURE_STEP_MIN) : null,
    [],
  )
}
