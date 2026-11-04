import { useMutation } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { ApiError, request } from '../../lib/api'
import { ERROR_CODE, PICK_COORD_DECIMALS, PICK_STATUS, PLANNER_PATH } from '../../lib/constants'
import type { PickStatus, TripField } from '../../lib/constants'
import type { Place } from '../../lib/types'

/** The two fields a map point can fill. */
export type PickField = Extract<TripField, 'origin' | 'destination'>

const round = (value: number) => Number(value.toFixed(PICK_COORD_DECIMALS))

/**
 * "Choose on map" (Step-14b): `start` arms the map for a field, `pickAt` sends the point to
 * GET /api/places/reverse, and a found place goes to `onPicked`. The server turns the point into
 * the same signed place a search gives, so the plan never trusts browser coordinates. A point at
 * sea or outside the US and Canada keeps picking with a note. Esc or `cancel` stops.
 */
export function usePlacePick(onPicked: (field: PickField, place: Place) => void) {
  const [field, setField] = useState<PickField | null>(null)
  const lookup = useMutation({
    mutationFn: ({ lat, lon }: { lat: number; lon: number }) =>
      request<{ place: Place | null }>(
        `${PLANNER_PATH.PLACE_AT}?lat=${round(lat)}&lon=${round(lon)}`,
      ),
  })
  const { reset } = lookup

  const start = useCallback(
    (next: PickField) => {
      reset()
      setField(next)
    },
    [reset],
  )
  const cancel = useCallback(() => {
    reset()
    setField(null)
  }, [reset])

  const pickAt = useCallback(
    (lat: number, lon: number) => {
      if (!field || lookup.isPending) return
      lookup.mutate(
        { lat, lon },
        {
          onSuccess: ({ place }) => {
            if (!place) return
            setField(null)
            onPicked(field, place)
          },
        },
      )
    },
    [field, lookup, onPicked],
  )

  useEffect(() => {
    if (!field) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      cancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [field, cancel])

  const error = lookup.error instanceof ApiError ? lookup.error : null
  let status: PickStatus = PICK_STATUS.WAITING
  if (lookup.isPending) status = PICK_STATUS.LOOKING
  else if (lookup.isError) {
    status = error?.code === ERROR_CODE.SEARCH_LIMITED ? PICK_STATUS.LIMIT : PICK_STATUS.ERROR
  } else if (lookup.isSuccess && !lookup.data.place) status = PICK_STATUS.OUTSIDE

  return { field, status, retryAfterMin: error?.retryAfterMin, start, cancel, pickAt }
}
