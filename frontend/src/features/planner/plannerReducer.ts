// The planner's one state (architecture 12.4, design 8.6). Pure: no timers, no requests.
import {
  ERROR_CODE,
  INTERVAL_AUTO,
  LOAD_UNIT,
  PLANNER_STATUS,
  PLANNER_TAB,
  RECOMMENDATION,
} from '../../lib/constants'
import type {
  IntervalChoice,
  LoadUnit,
  PlannerStatus,
  PlannerTab,
  ProviderService,
  TripField,
} from '../../lib/constants'
import type { FormLoad, TripErrors, TripForm } from '../../lib/tripValidation'
import type { ApiErrorCode, Place, Plan } from '../../lib/types'

/** Why the planner is in `error` or `limited`: a code plus the extras the copy needs. */
export interface PlannerMessage {
  code: ApiErrorCode
  service?: ProviderService
  retryAfterMin?: number
}

export interface Selection {
  routeId: string | null
  checkpointN: number | null
}

export interface View {
  /** Heatmap hour, 0 to 48 */
  hour: number
  showHeatmap: boolean
  tab: PlannerTab
  /** The trip form is open over the results ("Edit"). */
  editing: boolean
}

/** Interval and HOS: the two settings an update changes. */
export interface PlanSettings {
  interval: IntervalChoice
  hos: boolean
}

export interface PlannerState {
  form: TripForm
  /** Problems shown under fields. Editing a field clears its own. */
  errors: TripErrors
  /** The last good answer. */
  plan: Plan | null
  /** The settings the current plan was made with; the form returns to them on a closed edit. */
  applied: PlanSettings
  status: PlannerStatus
  message: PlannerMessage | null
  selection: Selection
  view: View
}

export type PlannerAction =
  | { type: 'set_origin'; place: Place | null; defaultDeparture: string | null }
  | { type: 'set_destination'; place: Place | null }
  | { type: 'set_departure'; value: string }
  | { type: 'set_load'; load: FormLoad }
  | { type: 'set_interval'; interval: IntervalChoice }
  | { type: 'set_hos'; hos: boolean }
  | { type: 'swap_places'; defaultDeparture: string | null }
  | { type: 'submit_invalid'; errors: TripErrors }
  | { type: 'plan_started' }
  | { type: 'plan_succeeded'; plan: Plan }
  | { type: 'plan_failed'; message: PlannerMessage; fieldErrors: TripErrors }
  | { type: 'cancel' }
  | { type: 'edit_trip' }
  | { type: 'close_edit' }
  | { type: 'select_route'; routeId: string }
  | { type: 'select_checkpoint'; n: number | null }
  | { type: 'set_tab'; tab: PlannerTab }
  | { type: 'update_started'; settings: PlanSettings }
  | { type: 'update_succeeded'; plan: Plan }
  | { type: 'update_failed'; previous: PlanSettings; message: PlannerMessage | null }

export function initialPlannerState(loadUnit: LoadUnit = LOAD_UNIT.LB): PlannerState {
  return {
    form: {
      origin: null,
      destination: null,
      departureLocal: '',
      departureEdited: false,
      load: { value: null, unit: loadUnit },
      interval: INTERVAL_AUTO,
      hos: true,
    },
    errors: {},
    plan: null,
    applied: { interval: INTERVAL_AUTO, hos: true },
    status: PLANNER_STATUS.EMPTY,
    message: null,
    selection: { routeId: null, checkpointN: null },
    view: { hour: 0, showHeatmap: true, tab: PLANNER_TAB.ROUTES, editing: false },
  }
}

const LIMIT_CODES: readonly ApiErrorCode[] = [
  ERROR_CODE.RATE_LIMITED,
  ERROR_CODE.SEARCH_LIMITED,
  ERROR_CODE.PROVIDER_BUDGET,
]

/** The status a failed plan lands in (design 8.6). */
export function statusForError(code: ApiErrorCode): PlannerStatus {
  if (code === ERROR_CODE.NO_ROUTE) return PLANNER_STATUS.NO_ROUTE
  if (LIMIT_CODES.includes(code)) return PLANNER_STATUS.LIMITED
  return PLANNER_STATUS.ERROR
}

/** Recommended route, else the 1st best (design 8.3). Routes arrive in rank order. */
export function defaultRouteId(plan: Plan): string | null {
  const recommended = plan.routes.find((r) => r.recommendation === RECOMMENDATION.RECOMMENDED)
  if (recommended) return recommended.id
  const best = [...plan.routes].sort((a, b) => a.rank - b.rank)[0]
  return best?.id ?? null
}

function clearError(errors: TripErrors, ...fields: TripField[]): TripErrors {
  return Object.fromEntries(
    Object.entries(errors).filter(([field]) => !fields.includes(field as TripField)),
  )
}

/** Pick the origin; the default departure fills in until the driver edits the field. */
function withOrigin(form: TripForm, origin: Place | null, defaultDeparture: string | null) {
  const next: TripForm = { ...form, origin }
  if (!form.departureEdited)
    next.departureLocal = origin && defaultDeparture ? defaultDeparture : ''
  return next
}

export function plannerReducer(state: PlannerState, action: PlannerAction): PlannerState {
  switch (action.type) {
    case 'set_origin':
      return {
        ...state,
        form: withOrigin(state.form, action.place, action.defaultDeparture),
        errors: clearError(state.errors, 'origin', 'departure'),
      }
    case 'set_destination':
      return {
        ...state,
        form: { ...state.form, destination: action.place },
        errors: clearError(state.errors, 'destination'),
      }
    case 'set_departure':
      return {
        ...state,
        form: { ...state.form, departureLocal: action.value, departureEdited: true },
        errors: clearError(state.errors, 'departure'),
      }
    case 'set_load':
      return {
        ...state,
        form: { ...state.form, load: action.load },
        errors: clearError(state.errors, 'load'),
      }
    case 'set_interval':
      return { ...state, form: { ...state.form, interval: action.interval } }
    case 'set_hos':
      return { ...state, form: { ...state.form, hos: action.hos } }
    case 'swap_places': {
      const { origin, destination } = state.form
      return {
        ...state,
        form: withOrigin(
          { ...state.form, destination: origin },
          destination,
          action.defaultDeparture,
        ),
        errors: clearError(state.errors, 'origin', 'destination', 'departure'),
      }
    }
    case 'submit_invalid':
      return { ...state, errors: action.errors }
    case 'plan_started':
      // The old plan is cleared: the map shows the base map while planning (design 8.6).
      return {
        ...state,
        plan: null,
        status: PLANNER_STATUS.PLANNING,
        message: null,
        errors: {},
        selection: { routeId: null, checkpointN: null },
        view: { ...state.view, editing: false },
      }
    case 'plan_succeeded':
      return {
        ...state,
        plan: action.plan,
        applied: { interval: state.form.interval, hos: state.form.hos },
        status: PLANNER_STATUS.RESULTS,
        message: null,
        errors: {},
        selection: { routeId: defaultRouteId(action.plan), checkpointN: null },
        view: { ...state.view, hour: 0, tab: PLANNER_TAB.ROUTES, editing: false },
      }
    case 'plan_failed': {
      // A field problem is shown under its field, with the form still open and no banner.
      if (Object.keys(action.fieldErrors).length > 0) {
        return {
          ...state,
          status: PLANNER_STATUS.EMPTY,
          message: null,
          errors: action.fieldErrors,
        }
      }
      return {
        ...state,
        status: statusForError(action.message.code),
        message: action.message,
        errors: {},
      }
    }
    case 'cancel':
      // Cancel stops waiting; the form comes back with no error (design 8.6).
      if (state.status !== PLANNER_STATUS.PLANNING) return state
      return { ...state, status: PLANNER_STATUS.EMPTY, message: null }
    case 'edit_trip':
      // With results on screen the form opens over them; otherwise the form simply comes back.
      if (state.plan) return { ...state, message: null, view: { ...state.view, editing: true } }
      return { ...state, status: PLANNER_STATUS.EMPTY, message: null }
    case 'close_edit':
      if (!state.view.editing) return state
      return {
        ...state,
        errors: {},
        form: { ...state.form, ...state.applied },
        view: { ...state.view, editing: false },
      }
    case 'select_route':
      // The same route again (a tap on a Checkpoint also taps the line under it) keeps the Checkpoint.
      if (action.routeId === state.selection.routeId) return state
      return { ...state, selection: { routeId: action.routeId, checkpointN: null } }
    case 'select_checkpoint':
      // Opening one shows it in the Checkpoints tab, where its row is highlighted.
      return {
        ...state,
        selection: { ...state.selection, checkpointN: action.n },
        view: action.n === null ? state.view : { ...state.view, tab: PLANNER_TAB.CHECKPOINTS },
      }
    case 'set_tab':
      return { ...state, view: { ...state.view, tab: action.tab } }
    case 'update_started':
      if (state.status !== PLANNER_STATUS.RESULTS) return state
      return {
        ...state,
        form: { ...state.form, ...action.settings },
        status: PLANNER_STATUS.UPDATING,
        message: null,
      }
    case 'update_succeeded': {
      // Route IDs are stable inside a bundle: keep the choice unless that route left the top 3.
      const kept = action.plan.routes.some((r) => r.id === state.selection.routeId)
      return {
        ...state,
        plan: action.plan,
        applied: { interval: state.form.interval, hos: state.form.hos },
        status: PLANNER_STATUS.RESULTS,
        message: null,
        selection: {
          routeId: kept ? state.selection.routeId : defaultRouteId(action.plan),
          checkpointN: null,
        },
      }
    }
    case 'update_failed':
      // The control returns to its old value and the old results stay.
      return {
        ...state,
        form: { ...state.form, ...action.previous },
        status: PLANNER_STATUS.RESULTS,
        message: action.message,
      }
    default:
      return state
  }
}
