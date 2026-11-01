import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { ApiError, request } from '../../lib/api'
import {
  ERROR_CODE,
  PLACE_QUERY_MIN,
  PLACE_SEARCH_DEBOUNCE_MS,
  PLANNER_PATH,
} from '../../lib/constants'
import type { Place } from '../../lib/types'

export const PLACE_SEARCH_STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  RESULTS: 'results',
  EMPTY: 'empty',
  ERROR: 'error',
  LIMIT: 'limit',
} as const
export type PlaceSearchStatus = (typeof PLACE_SEARCH_STATUS)[keyof typeof PLACE_SEARCH_STATUS]

/** A value that follows `value` after it has stayed the same for `ms`. */
function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return settled
}

/**
 * GET /api/places for what the driver types (design 4.2). Needs 2+ characters and a 250 ms
 * pause; each query's answer is kept for the session (`staleTime: Infinity`) and a request that
 * is no longer wanted is cancelled through the query's signal, to save Geoapify calls.
 */
export function usePlaceSearch(text: string) {
  const query = text.trim()
  const settled = useDebounced(query, PLACE_SEARCH_DEBOUNCE_MS)
  const enabled = settled.length >= PLACE_QUERY_MIN

  const result = useQuery({
    queryKey: ['places', settled],
    queryFn: ({ signal }) =>
      request<{ places: Place[] }>(`${PLANNER_PATH.PLACES}?q=${encodeURIComponent(settled)}`, {
        signal,
      }),
    enabled,
    staleTime: Infinity,
    retry: false,
    placeholderData: keepPreviousData,
  })

  const error = result.error instanceof ApiError ? result.error : null
  const waiting = query.length >= PLACE_QUERY_MIN && query !== settled

  let status: PlaceSearchStatus = PLACE_SEARCH_STATUS.IDLE
  if (query.length < PLACE_QUERY_MIN) status = PLACE_SEARCH_STATUS.IDLE
  else if (waiting || result.isFetching) status = PLACE_SEARCH_STATUS.LOADING
  else if (result.isError) {
    status =
      error?.code === ERROR_CODE.SEARCH_LIMITED
        ? PLACE_SEARCH_STATUS.LIMIT
        : PLACE_SEARCH_STATUS.ERROR
  } else if (result.data) {
    status = result.data.places.length > 0 ? PLACE_SEARCH_STATUS.RESULTS : PLACE_SEARCH_STATUS.EMPTY
  }

  const places = status === PLACE_SEARCH_STATUS.RESULTS ? (result.data?.places ?? []) : []

  return {
    status,
    places,
    retryAfterMin: error?.retryAfterMin,
    retry: () => void result.refetch(),
  }
}
