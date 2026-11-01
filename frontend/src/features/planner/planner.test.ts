import { describe, expect, it } from 'vitest'
import { joinCauses } from '../../lib/checkpointText'
import {
  CAUSE,
  CAUSE_BIT,
  ERROR_CODE,
  INTERVAL_AUTO,
  LOAD_UNIT,
  PLANNER_STATUS,
  PLANNER_TAB,
  RECOMMENDATION,
  TRUCK_STATUS,
  UNIT_SYSTEM,
} from '../../lib/constants'
import {
  cellTooltipText,
  hourInWindow,
  levelOfCode,
  sliderValueText,
  truckText,
} from '../../lib/heatmapText'
import type { HeatmapCell, Plan } from '../../lib/types'
import {
  defaultRouteId,
  initialPlannerState,
  plannerReducer,
  statusForError,
} from './plannerReducer'
import type { PlannerState } from './plannerReducer'

const place = (token: string) => ({ label: token, tz: 'America/Chicago', token })

function planWith(routes: { id: string; rank: number; recommendation: string }[]): Plan {
  return {
    routes,
    trip: {
      departure_utc: '2026-11-04T06:00:00Z',
      origin: { tz: 'America/Chicago' },
    },
  } as unknown as Plan
}

const plan = planWith([
  { id: 'a', rank: 2, recommendation: RECOMMENDATION.NOT_RECOMMENDED },
  { id: 'b', rank: 1, recommendation: RECOMMENDATION.RECOMMENDED },
])

const run = (state: PlannerState, ...actions: Parameters<typeof plannerReducer>[1][]) =>
  actions.reduce(plannerReducer, state)

describe('plannerReducer', () => {
  it('fills the default departure until the driver edits it', () => {
    const s0 = initialPlannerState()
    const s1 = run(s0, {
      type: 'set_origin',
      place: place('A'),
      defaultDeparture: '2026-11-04T08:00',
    })
    expect(s1.form.departureLocal).toBe('2026-11-04T08:00')
    const s2 = run(s1, { type: 'set_departure', value: '2026-11-05T09:00' })
    const s3 = run(s2, {
      type: 'set_origin',
      place: place('B'),
      defaultDeparture: '2026-11-04T10:00',
    })
    expect(s3.form.departureLocal).toBe('2026-11-05T09:00')
  })

  it('clears a field error when that field is edited', () => {
    const s = run(
      initialPlannerState(),
      { type: 'submit_invalid', errors: { load: 'bad', destination: 'bad' } },
      { type: 'set_load', load: { value: 5, unit: LOAD_UNIT.LB } },
    )
    expect(s.errors).toEqual({ destination: 'bad' })
  })

  it('swaps places', () => {
    const s = run(
      initialPlannerState(),
      { type: 'set_origin', place: place('A'), defaultDeparture: null },
      { type: 'set_destination', place: place('B') },
      { type: 'swap_places', defaultDeparture: null },
    )
    expect(s.form.origin?.token).toBe('B')
    expect(s.form.destination?.token).toBe('A')
  })

  it('goes planning -> results and picks the recommended route', () => {
    const s = run(initialPlannerState(), { type: 'plan_started' }, { type: 'plan_succeeded', plan })
    expect(s.status).toBe(PLANNER_STATUS.RESULTS)
    expect(s.selection.routeId).toBe('b')
    expect(
      defaultRouteId(
        planWith([
          { id: 'x', rank: 3, recommendation: 'not_recommended' },
          { id: 'y', rank: 1, recommendation: 'not_recommended' },
        ]),
      ),
    ).toBe('y')
  })

  it('clears the old plan when a new one starts', () => {
    const s = run(initialPlannerState(), { type: 'plan_succeeded', plan }, { type: 'plan_started' })
    expect(s.plan).toBeNull()
    expect(s.status).toBe(PLANNER_STATUS.PLANNING)
  })

  it('shows field errors under the form, other failures as a status', () => {
    const base = run(initialPlannerState(), { type: 'plan_started' })
    const field = run(base, {
      type: 'plan_failed',
      message: { code: ERROR_CODE.SAME_PLACE },
      fieldErrors: { destination: 'same' },
    })
    expect(field.status).toBe(PLANNER_STATUS.EMPTY)
    expect(field.errors.destination).toBe('same')
    const limited = run(base, {
      type: 'plan_failed',
      message: { code: ERROR_CODE.RATE_LIMITED, retryAfterMin: 5 },
      fieldErrors: {},
    })
    expect(limited.status).toBe(PLANNER_STATUS.LIMITED)
    expect(limited.message?.retryAfterMin).toBe(5)
  })

  it('maps error codes to statuses', () => {
    expect(statusForError(ERROR_CODE.NO_ROUTE)).toBe(PLANNER_STATUS.NO_ROUTE)
    expect(statusForError(ERROR_CODE.SEARCH_LIMITED)).toBe(PLANNER_STATUS.LIMITED)
    expect(statusForError(ERROR_CODE.PROVIDER_BUDGET)).toBe(PLANNER_STATUS.LIMITED)
    expect(statusForError(ERROR_CODE.PROVIDER_UNAVAILABLE)).toBe(PLANNER_STATUS.ERROR)
  })

  it('cancel only works while planning', () => {
    const idle = initialPlannerState()
    expect(run(idle, { type: 'cancel' })).toBe(idle)
    const s = run(idle, { type: 'plan_started' }, { type: 'cancel' })
    expect(s.status).toBe(PLANNER_STATUS.EMPTY)
  })

  it('a closed edit returns the form to the applied settings', () => {
    const s = run(
      initialPlannerState(),
      { type: 'plan_succeeded', plan },
      { type: 'edit_trip' },
      { type: 'set_interval', interval: 50 },
      { type: 'set_hos', hos: false },
      { type: 'close_edit' },
    )
    expect(s.form.interval).toBe(INTERVAL_AUTO)
    expect(s.form.hos).toBe(true)
    expect(s.view.editing).toBe(false)
  })

  it('selecting a checkpoint opens the Checkpoints tab; same route keeps it', () => {
    const s = run(
      initialPlannerState(),
      { type: 'plan_succeeded', plan },
      { type: 'select_checkpoint', n: 3 },
    )
    expect(s.view.tab).toBe(PLANNER_TAB.CHECKPOINTS)
    expect(run(s, { type: 'select_route', routeId: 'b' }).selection.checkpointN).toBe(3)
    expect(run(s, { type: 'select_route', routeId: 'a' }).selection).toEqual({
      routeId: 'a',
      checkpointN: null,
    })
  })

  it('an update goes updating -> results, and a failure restores the settings', () => {
    const results = run(initialPlannerState(), { type: 'plan_succeeded', plan })
    const updating = run(results, {
      type: 'update_started',
      settings: { interval: 25, hos: false },
    })
    expect(updating.status).toBe(PLANNER_STATUS.UPDATING)
    const failed = run(updating, {
      type: 'update_failed',
      previous: results.applied,
      message: { code: ERROR_CODE.PROVIDER_UNAVAILABLE },
    })
    expect(failed.status).toBe(PLANNER_STATUS.RESULTS)
    expect(failed.form.interval).toBe(INTERVAL_AUTO)
    expect(failed.plan).toBe(plan)
    // an update only starts from results
    const empty = initialPlannerState()
    expect(run(empty, { type: 'update_started', settings: { interval: 10, hos: true } })).toBe(
      empty,
    )
  })

  it('an update keeps the chosen route unless it left the top routes', () => {
    const chosen = run(
      initialPlannerState(),
      { type: 'plan_succeeded', plan },
      { type: 'select_route', routeId: 'a' },
      { type: 'update_started', settings: { interval: 10, hos: true } },
    )
    const kept = run(chosen, { type: 'update_succeeded', plan })
    expect(kept.selection.routeId).toBe('a')
    const gone = run(chosen, {
      type: 'update_succeeded',
      plan: planWith([{ id: 'z', rank: 1, recommendation: RECOMMENDATION.RECOMMENDED }]),
    })
    expect(gone.selection.routeId).toBe('z')
  })
})

describe('heatmap text', () => {
  const heatPlan = {
    trip: { departure_utc: '2026-11-04T06:00:00Z', origin: { tz: 'America/Chicago' } },
    heatmap: { hours: [{ in_window: true }, { in_window: false }] },
  } as unknown as Plan

  it('decodes level codes', () => {
    expect(levelOfCode('0')).toBe('low')
    expect(levelOfCode('4')).toBe('no_travel')
    expect(levelOfCode('-')).toBeNull()
  })

  it('words a cell tooltip', () => {
    const cell = {
      lv: '0' + '3' + '1' + '-'.repeat(46),
      cz: [0, CAUSE_BIT.WIND | CAUSE_BIT.SNOW | CAUSE_BIT.LOAD_RULE, CAUSE_BIT.RAIN],
    } as unknown as HeatmapCell
    expect(cellTooltipText(cell, heatPlan, 0)).toBe('Low · Wed, Nov 4 · 12:00 AM CST')
    expect(cellTooltipText(cell, heatPlan, 1)).toBe(
      'Severe, set by wind and snow, raised by the load rule · Wed, Nov 4 · 1:00 AM CST',
    )
    expect(cellTooltipText(cell, heatPlan, 2)).toContain('Moderate, set by rain')
    expect(cellTooltipText(cell, heatPlan, 3)).toBe('No weather data · Wed, Nov 4 · 3:00 AM CST')
  })

  it('words the slider value and the window', () => {
    expect(hourInWindow(heatPlan, 1)).toBe(false)
    expect(sliderValueText(heatPlan, 0)).toBe('+0 h · Wed, Nov 4 · 12:00 AM CST')
    expect(sliderValueText(heatPlan, 1)).toContain('No forecast for this hour')
  })

  it('words the truck state', () => {
    const imp = UNIT_SYSTEM.IMPERIAL
    expect(truckText(undefined, 100, imp)).toBe('')
    expect(truckText({ status: TRUCK_STATUS.ARRIVED, mile: 100 } as never, 100, imp)).toBe(
      'Truck has arrived',
    )
    expect(truckText({ status: TRUCK_STATUS.REST, mile: 75 } as never, 412, imp)).toBe(
      'Truck on a 10 h rest at mile 75 of 412',
    )
    expect(truckText({ status: TRUCK_STATUS.DRIVING, mile: 75 } as never, 412, imp)).toBe(
      'Truck at mile 75 of 412',
    )
  })

  it('joins causes in a fixed order', () => {
    expect(joinCauses([CAUSE.SNOW, CAUSE.WIND])).toBe('wind and snow')
    expect(joinCauses([CAUSE.SNOW, CAUSE.RAIN, CAUSE.WIND])).toBe('wind, rain and snow')
    expect(joinCauses([])).toBe('')
  })
})
