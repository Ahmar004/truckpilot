import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { request, resetCsrfToken } from '../lib/api'
import { AUTH_PATH, ROUTE_PATH } from '../lib/constants'
import { SESSION_QUERY_KEY } from './useSession'
import type { SessionResponse } from './useSession'

/** Send Google's credential to the server; on success remember the user and open the planner. */
export function useSignIn() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: (credential: string) =>
      request<SessionResponse>(AUTH_PATH.GOOGLE, { method: 'POST', json: { credential } }),
    onSuccess: (data) => {
      resetCsrfToken()
      queryClient.setQueryData(SESSION_QUERY_KEY, data)
      navigate(ROUTE_PATH.PLAN)
    },
  })
}
