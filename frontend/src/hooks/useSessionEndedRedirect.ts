import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { ApiError } from '../lib/api'
import { ERROR_CODE, SESSION_ENDED_PARAM, SESSION_ENDED_VALUE } from '../lib/constants'
import { forgetSession, SESSION_QUERY_KEY } from './useSession'

const SESSION_ENDED_SEARCH = `?${SESSION_ENDED_PARAM}=${SESSION_ENDED_VALUE}`

function isNotSignedIn(error: unknown): boolean {
  return error instanceof ApiError && error.code === ERROR_CODE.NOT_SIGNED_IN
}

/**
 * F12: a "not signed in" answer from any call, after the session was known, clears the cache and
 * reopens the sign-in pop-up on the same page with a message. The first session check is not counted:
 * the planner guard handles that one without a message.
 */
export function useSessionEndedRedirect() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  useEffect(() => {
    function onNotSignedIn(hadSession: boolean) {
      if (!hadSession) return
      navigate({ search: SESSION_ENDED_SEARCH }, { replace: true })
      forgetSession(queryClient)
    }
    const stopQueries = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'error') return
      if (!isNotSignedIn(event.action.error)) return
      const isSession = event.query.queryKey[0] === SESSION_QUERY_KEY[0]
      onNotSignedIn(
        isSession
          ? event.query.state.data !== undefined
          : queryClient.getQueryData(SESSION_QUERY_KEY) !== undefined,
      )
    })
    const stopMutations = queryClient.getMutationCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'error') return
      if (!isNotSignedIn(event.action.error)) return
      onNotSignedIn(queryClient.getQueryData(SESSION_QUERY_KEY) !== undefined)
    })
    return () => {
      stopQueries()
      stopMutations()
    }
  }, [queryClient, navigate])
}
