import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router'
import { track } from '../lib/analytics'
import { request, resetCsrfToken } from '../lib/api'
import { ANALYTICS_EVENT, AUTH_PATH } from '../lib/constants'
import { SESSION_QUERY_KEY } from './useSession'
import type { SessionResponse } from './useSession'

/** Send Google's credential to the server; on success remember the user. The planner stays open
 * (the sign-in pop-up closes) and a leftover "session ended" flag leaves the address. */
export function useSignIn() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return useMutation({
    mutationFn: (credential: string) =>
      request<SessionResponse>(AUTH_PATH.GOOGLE, { method: 'POST', json: { credential } }),
    onSuccess: (data) => {
      resetCsrfToken()
      track(ANALYTICS_EVENT.SIGNED_IN)
      queryClient.setQueryData(SESSION_QUERY_KEY, data)
      navigate(pathname, { replace: true })
    },
  })
}
