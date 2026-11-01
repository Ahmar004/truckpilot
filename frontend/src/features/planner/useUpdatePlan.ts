import { useMutation } from '@tanstack/react-query'
import { request } from '../../lib/api'
import { PLANNER_PATH } from '../../lib/constants'
import type { Plan, UpdateRequest } from '../../lib/types'

/** POST /api/plans/update: new interval or HOS setting on the plan's signed route bundle. */
export function useUpdatePlan() {
  const mutation = useMutation({
    mutationFn: (body: UpdateRequest) =>
      request<Plan>(PLANNER_PATH.UPDATE, { method: 'POST', json: body }),
  })
  return { updatePlan: mutation.mutateAsync }
}
