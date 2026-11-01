import { useQuery } from '@tanstack/react-query'
import { ApiError, request } from '../lib/api'
import { AUTH_PATH, ERROR_CODE } from '../lib/constants'
import type { SessionUser } from '../lib/types'

export const SESSION_QUERY_KEY = ['session'] as const
const SESSION_STALE_MS = 5 * 60 * 1000

export type SessionResponse = { user: SessionUser }

/** Who is signed in (GET /api/me). A 401 `not_signed_in` means signed out. */
export function useSession() {
  const query = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: ({ signal }) => request<SessionResponse>(AUTH_PATH.ME, { signal }),
    staleTime: SESSION_STALE_MS,
    retry: false,
  })
  const isSignedOut =
    query.error instanceof ApiError && query.error.code === ERROR_CODE.NOT_SIGNED_IN
  return {
    user: query.data?.user,
    isLoading: query.isPending,
    isSignedOut,
    isError: query.isError && !isSignedOut,
    refetch: query.refetch,
  }
}
