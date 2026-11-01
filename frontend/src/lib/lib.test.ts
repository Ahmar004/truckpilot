import { describe, expect, it } from 'vitest'
import { ERROR_CODE, LOAD_UNIT, PROVIDER_SERVICE, TRIP_FIELD, UNIT_SYSTEM } from './constants'
import {
  budgetLimitText,
  planLimitText,
  retryText,
  searchLimitText,
  updateFailureText,
} from './limitText'
import { decodePolyline } from './polyline'
import { rankLabel } from './routeLabel'
import { formatTime, nextQuarterHour, nowInZone, zoneAbbreviation } from './time'
import { TRIP_ERROR_TEXT, isLoadValid, serverFieldErrors, validateTrip } from './tripValidation'
import type { TripForm } from './tripValidation'
import {
  displayLoad,
  formatDistance,
  formatDuration,
  formatLoad,
  formatMileMarker,
  formatMileOf,
  formatPrecip,
  formatRiskMiles,
  formatWind,
} from './units'

const IMP = UNIT_SYSTEM.IMPERIAL
const MET = UNIT_SYSTEM.METRIC

describe('units', () => {
  it('formats wind, precipitation and distance in both systems', () => {
    expect(formatWind(24.6, IMP)).toBe('24.6 mph')
    expect(formatWind(10, MET)).toBe('16.1 km/h')
    expect(formatPrecip(0.1, IMP)).toBe('0.100 in/hr')
    expect(formatPrecip(0.1, MET)).toBe('2.54 mm/hr')
    expect(formatDistance(412, IMP)).toBe('412 mi')
    expect(formatDistance(412, MET)).toBe('663 km')
  })

  it('formats risk miles, with the under-0.1 case', () => {
    expect(formatRiskMiles(0, IMP)).toBe('0.0 mi')
    expect(formatRiskMiles(0.04, IMP)).toBe('under 0.1 mi')
    expect(formatRiskMiles(12.34, IMP)).toBe('12.3 mi')
  })

  it('formats mile markers', () => {
    expect(formatMileMarker(75.4, IMP)).toBe('Mile 75')
    expect(formatMileMarker(75, MET)).toBe('Km 121')
    expect(formatMileOf(75, 412, IMP)).toBe('Mile 75 of 412')
    expect(formatMileOf(75, 412, MET)).toBe('Km 121 of 663')
  })

  it('formats durations', () => {
    expect(formatDuration(5)).toBe('5 min')
    expect(formatDuration(120)).toBe('2 h')
    expect(formatDuration(845)).toBe('14 h 5 min')
    expect(formatDuration(-3)).toBe('0 min')
  })

  it('keeps the load as typed and converts to the other unit', () => {
    const typed = { value: 42000, unit: LOAD_UNIT.LB }
    expect(displayLoad(typed, IMP)).toBe(typed)
    expect(displayLoad(typed, MET)).toEqual({ value: 19051, unit: LOAD_UNIT.KG })
    expect(displayLoad({ value: 19051, unit: LOAD_UNIT.KG }, IMP)).toEqual({
      value: 42000,
      unit: LOAD_UNIT.LB,
    })
    expect(formatLoad(typed)).toBe('42,000 lb')
  })
})

describe('time', () => {
  const utc = '2026-11-03T21:40:00Z'
  it('shows a time in the zone of its own place', () => {
    expect(formatTime(utc, 'America/Chicago')).toBe('Tue, Nov 3 · 3:40 PM CST')
    expect(formatTime(utc, 'America/New_York')).toBe('Tue, Nov 3 · 4:40 PM EST')
    expect(zoneAbbreviation(utc, 'America/Chicago')).toBe('CST')
  })
  it('gives wall time in a zone', () => {
    expect(nowInZone('America/Chicago', new Date(utc))).toBe('2026-11-03T15:40')
    expect(nowInZone('America/New_York', new Date(utc))).toBe('2026-11-03T16:40')
  })
  it('rounds up to the next quarter hour, past midnight too', () => {
    expect(nextQuarterHour('UTC', new Date('2026-11-03T10:00:00Z'))).toBe('2026-11-03T10:15')
    expect(nextQuarterHour('UTC', new Date('2026-11-03T10:07:00Z'))).toBe('2026-11-03T10:15')
    expect(nextQuarterHour('UTC', new Date('2026-11-03T23:50:00Z'))).toBe('2026-11-04T00:00')
  })
})

describe('polyline', () => {
  it('decodes the reference example into [lon, lat] pairs', () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      [-120.2, 38.5],
      [-120.95, 40.7],
      [-126.453, 43.252],
    ])
  })
  it('returns nothing for an empty string', () => {
    expect(decodePolyline('')).toEqual([])
  })
})

describe('rankLabel', () => {
  it('names ranks', () => {
    expect(rankLabel(1)).toBe('1st best')
    expect(rankLabel(3)).toBe('3rd best')
    expect(rankLabel(4)).toBe('4th best')
  })
})

describe('limit text', () => {
  it('words retry times', () => {
    expect(retryText(1)).toBe('Try again in 1 minute')
    expect(retryText(25)).toBe('Try again in 25 minutes')
    expect(retryText(845)).toBe('Try again in 14 h 5 min')
    expect(searchLimitText(25)).toBe('Search limit reached. Try again in 25 minutes.')
    expect(planLimitText(25)).toBe('Limit reached. Try again in 25 minutes.')
  })
  it('words update failures by code', () => {
    expect(updateFailureText({ code: ERROR_CODE.RATE_LIMITED, retryAfterMin: 10 })).toBe(
      planLimitText(10),
    )
    expect(
      updateFailureText({ code: ERROR_CODE.PROVIDER_BUDGET, service: PROVIDER_SERVICE.ROUTING }),
    ).toBe(budgetLimitText(PROVIDER_SERVICE.ROUTING))
    expect(updateFailureText({ code: ERROR_CODE.PROVIDER_UNAVAILABLE })).toBe(
      'Service unavailable.',
    )
  })
})

describe('trip validation', () => {
  const chicago = { label: 'Chicago, IL', tz: 'America/Chicago', token: 'a' }
  const dallas = { label: 'Dallas, TX', tz: 'America/Chicago', token: 'b' }
  const now = new Date('2026-11-03T21:40:00Z')
  const good: TripForm = {
    origin: chicago,
    destination: dallas,
    departureLocal: '2026-11-04T08:00',
    departureEdited: true,
    load: { value: 42000, unit: LOAD_UNIT.LB },
    interval: 25 as TripForm['interval'],
    hos: false,
  }
  const check = (patch: Partial<TripForm>) => validateTrip({ ...good, ...patch }, LOAD_UNIT.LB, now)

  it('accepts a good form', () => {
    expect(check({})).toEqual({})
  })
  it('flags missing and same places', () => {
    const e = check({ origin: null, destination: null })
    expect(e[TRIP_FIELD.ORIGIN]).toBe(TRIP_ERROR_TEXT.PICK_PLACE)
    expect(e[TRIP_FIELD.DESTINATION]).toBe(TRIP_ERROR_TEXT.PICK_PLACE)
    const same = check({ destination: { ...dallas, label: ' chicago, il ' } })
    expect(same[TRIP_FIELD.DESTINATION]).toBe(TRIP_ERROR_TEXT.SAME_PLACE)
  })
  it('compares the departure with now in the origin zone', () => {
    // 15:40 in Chicago: 15:30 has passed, 15:45 has not
    expect(check({ departureLocal: '2026-11-03T15:30' })[TRIP_FIELD.DEPARTURE]).toBe(
      TRIP_ERROR_TEXT.DEPARTURE_PASSED,
    )
    expect(check({ departureLocal: '2026-11-03T15:45' })).toEqual({})
    expect(check({ departureLocal: '' })[TRIP_FIELD.DEPARTURE]).toBe(
      TRIP_ERROR_TEXT.DEPARTURE_MISSING,
    )
  })
  it('checks the load range per unit', () => {
    expect(isLoadValid({ value: 80000, unit: LOAD_UNIT.LB })).toBe(true)
    expect(isLoadValid({ value: 80001, unit: LOAD_UNIT.LB })).toBe(false)
    expect(isLoadValid({ value: 36287, unit: LOAD_UNIT.KG })).toBe(true)
    expect(isLoadValid({ value: 36288, unit: LOAD_UNIT.KG })).toBe(false)
    expect(isLoadValid({ value: 10.5, unit: LOAD_UNIT.LB })).toBe(false)
    expect(isLoadValid({ value: null, unit: LOAD_UNIT.LB })).toBe(false)
    expect(isLoadValid({ value: -1, unit: LOAD_UNIT.LB })).toBe(false)
  })
  it('maps server field errors', () => {
    expect(serverFieldErrors(ERROR_CODE.SAME_PLACE, undefined, LOAD_UNIT.LB)).toEqual({
      [TRIP_FIELD.DESTINATION]: TRIP_ERROR_TEXT.SAME_PLACE,
    })
    const e = serverFieldErrors(
      ERROR_CODE.INVALID_INPUT,
      { load: 'bad', origin: 'bad' },
      LOAD_UNIT.KG,
    )
    expect(e[TRIP_FIELD.LOAD]).toContain('36,287 kg')
    expect(e[TRIP_FIELD.ORIGIN]).toBe(TRIP_ERROR_TEXT.PICK_PLACE)
  })
})
