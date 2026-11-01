import { useMutation } from '@tanstack/react-query'
import { useCallback, useRef } from 'react'
import { request } from '../../lib/api'
import { PLANNER_PATH } from '../../lib/constants'
import type { TripForm } from '../../lib/tripValidation'
import type { Plan, PlanRequest } from '../../lib/types'

/** The request body for a form that passed its checks (architecture 4.1). */
export function buildPlanRequest(form: TripForm): PlanRequest | null {
  const { origin, destination, load } = form
  if (!origin || !destination || load.value === null) return null
  return {
    origin: origin.token,
    destination: destination.token,
    departure_local: form.departureLocal,
    load: { value: load.value, unit: load.unit },
    interval: form.interval,
    hos: form.hos,
  }
}

export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

/** POST /api/plans. `cancel` aborts the request in flight, so the driver stops waiting. */
export function usePlanTrip() {
  const controller = useRef<AbortController | null>(null)
  const mutation = useMutation({
    mutationFn: (body: PlanRequest) => {
      controller.current = new AbortController()
      return request<Plan>(PLANNER_PATH.PLANS, {
        method: 'POST',
        json: body,
        signal: controller.current.signal,
      })
    },
  })
  const { mutateAsync } = mutation

  const cancel = useCallback(() => {
    controller.current?.abort()
    controller.current = null
  }, [])

  return { planTrip: mutateAsync, cancel, isPending: mutation.isPending }
}
