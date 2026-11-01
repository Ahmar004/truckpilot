import { useCallback, useReducer } from 'react'
import { useUnits } from '../../hooks/useUnits'
import { ApiError } from '../../lib/api'
import { CLIENT_ERROR_CODE } from '../../lib/constants'
import type { IntervalChoice } from '../../lib/constants'
import { serverFieldErrors, validateTrip } from '../../lib/tripValidation'
import type { FormLoad } from '../../lib/tripValidation'
import type { Place } from '../../lib/types'
import { loadUnitFor } from '../../lib/units'
import { initialPlannerState, plannerReducer } from './plannerReducer'
import { useDepartureDefault } from './useDepartureDefault'
import { buildPlanRequest, isAbort, usePlanTrip } from './usePlanTrip'

/** The planner's state and its actions. The Planner page passes slices down as props. */
export function usePlanner() {
  const { units } = useUnits()
  const displayUnit = loadUnitFor(units)
  const [state, dispatch] = useReducer(plannerReducer, displayUnit, initialPlannerState)
  const departureDefault = useDepartureDefault()
  const { planTrip, cancel: abortRequest } = usePlanTrip()

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
      submit,
      cancel,
    },
  }
}
