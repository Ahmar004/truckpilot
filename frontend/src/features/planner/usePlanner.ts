import { useCallback, useEffect, useReducer, useRef } from 'react'
import { useToast } from '../../hooks/useToast'
import { useUnits } from '../../hooks/useUnits'
import { ApiError } from '../../lib/api'
import { CLIENT_ERROR_CODE, ERROR_CODE, PLANNER_STATUS } from '../../lib/constants'
import type { IntervalChoice, PlannerTab } from '../../lib/constants'
import { updateFailureText } from '../../lib/limitText'
import { serverFieldErrors, validateTrip } from '../../lib/tripValidation'
import type { FormLoad } from '../../lib/tripValidation'
import type { Place } from '../../lib/types'
import { loadUnitFor } from '../../lib/units'
import { initialPlannerState, plannerReducer } from './plannerReducer'
import type { PlanSettings } from './plannerReducer'
import { useDepartureDefault } from './useDepartureDefault'
import { buildPlanRequest, isAbort, usePlanTrip } from './usePlanTrip'
import { useUpdatePlan } from './useUpdatePlan'

/** The planner's state and its actions. The Planner page passes slices down as props. */
export function usePlanner() {
  const { units } = useUnits()
  const displayUnit = loadUnitFor(units)
  const [state, dispatch] = useReducer(plannerReducer, displayUnit, initialPlannerState)
  const departureDefault = useDepartureDefault()
  const { planTrip, cancel: abortRequest } = usePlanTrip()
  const { updatePlan } = useUpdatePlan()
  const showToast = useToast()

  const setOrigin = useCallback(
    (place: Place | null) =>
      dispatch({
        type: 'set_origin',
        place,
        defaultDeparture: departureDefault(place?.tz ?? null),
      }),
    [departureDefault],
  )
  const setDestination = useCallback(
    (place: Place | null) => dispatch({ type: 'set_destination', place }),
    [],
  )
  const swapPlaces = useCallback(
    () =>
      dispatch({
        type: 'swap_places',
        defaultDeparture: departureDefault(state.form.destination?.tz ?? null),
      }),
    [departureDefault, state.form.destination],
  )
  const setDeparture = useCallback(
    (value: string) => dispatch({ type: 'set_departure', value }),
    [],
  )
  const setLoad = useCallback((load: FormLoad) => dispatch({ type: 'set_load', load }), [])
  const setIntervalChoice = useCallback(
    (interval: IntervalChoice) => dispatch({ type: 'set_interval', interval }),
    [],
  )
  const setHos = useCallback((hos: boolean) => dispatch({ type: 'set_hos', hos }), [])
  const editTrip = useCallback(() => dispatch({ type: 'edit_trip' }), [])

  const submit = useCallback(async () => {
    const errors = validateTrip(state.form, displayUnit)
    const body = buildPlanRequest(state.form)
    if (Object.keys(errors).length > 0 || !body) {
      dispatch({ type: 'submit_invalid', errors })
      return
    }
    dispatch({ type: 'plan_started' })
    try {
      const plan = await planTrip(body)
      dispatch({ type: 'plan_succeeded', plan })
    } catch (error) {
      if (isAbort(error)) return // Cancel already put the form back
      const api = error instanceof ApiError ? error : new ApiError(CLIENT_ERROR_CODE.NETWORK)
      dispatch({
        type: 'plan_failed',
        message: { code: api.code, service: api.service, retryAfterMin: api.retryAfterMin },
        fieldErrors: serverFieldErrors(api.code, api.fields, displayUnit),
      })
    }
  }, [state.form, displayUnit, planTrip])

  // Retry on a toast runs the latest version of the update.
  const retry = useRef<((settings: PlanSettings) => Promise<void>) | null>(null)
  const plan = state.plan
  const formInterval = state.form.interval
  const formHos = state.form.hos
  const canUpdate = state.status === PLANNER_STATUS.RESULTS

  /** Change interval or HOS on the current plan (design F6). Failure restores the old setting. */
  const updateSettings = useCallback(
    async (settings: PlanSettings) => {
      if (!plan || !canUpdate) return
      const previous: PlanSettings = { interval: formInterval, hos: formHos }
      dispatch({ type: 'update_started', settings })
      try {
        const next = await updatePlan({ bundle: plan.bundle, ...settings })
        dispatch({ type: 'update_succeeded', plan: next })
      } catch (error) {
        const api = error instanceof ApiError ? error : new ApiError(CLIENT_ERROR_CODE.NETWORK)
        if (api.code === ERROR_CODE.DEPARTURE_PASSED) {
          dispatch({
            type: 'update_failed',
            previous,
            message: { code: api.code },
          })
          return
        }
        dispatch({ type: 'update_failed', previous, message: null })
        showToast(updateFailureText(api), undefined, {
          label: 'Retry',
          run: () => void retry.current?.(settings),
        })
      }
    },
    [plan, canUpdate, formInterval, formHos, updatePlan, showToast],
  )
  useEffect(() => {
    retry.current = updateSettings
  }, [updateSettings])
  const updateInterval = useCallback(
    (interval: IntervalChoice) => void updateSettings({ interval, hos: formHos }),
    [updateSettings, formHos],
  )
  const updateHos = useCallback(
    (hos: boolean) => void updateSettings({ interval: formInterval, hos }),
    [updateSettings, formInterval],
  )
  const selectRoute = useCallback(
    (routeId: string) => dispatch({ type: 'select_route', routeId }),
    [],
  )
  const selectCheckpoint = useCallback(
    (n: number | null) => dispatch({ type: 'select_checkpoint', n }),
    [],
  )
  const setTab = useCallback((tab: PlannerTab) => dispatch({ type: 'set_tab', tab }), [])
  const closeEdit = useCallback(() => dispatch({ type: 'close_edit' }), [])

  const cancel = useCallback(() => {
    abortRequest()
    dispatch({ type: 'cancel' })
  }, [abortRequest])

  return {
    state,
    actions: {
      setOrigin,
      setDestination,
      swapPlaces,
      setDeparture,
      setLoad,
      setIntervalChoice,
      setHos,
      editTrip,
      closeEdit,
      updateInterval,
      updateHos,
      selectRoute,
      selectCheckpoint,
      setTab,
      submit,
      cancel,
    },
  }
}
