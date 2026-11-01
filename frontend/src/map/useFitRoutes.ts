import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { PaddingOptions } from 'maplibre-gl'
import { decodePolyline } from '../lib/polyline'
import type { Plan } from '../lib/types'

type Bounds = [number, number, number, number]

/** Bounds of every route in the plan: [west, south, east, north], or null with no plan. */
function planBounds(plan: Plan | null): Bounds | null {
  if (!plan) return null
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  for (const route of plan.routes) {
    for (const [lng, lat] of decodePolyline(route.line)) {
      west = Math.min(west, lng)
      east = Math.max(east, lng)
      south = Math.min(south, lat)
      north = Math.max(north, lat)
    }
  }
  return west <= east ? [west, south, east, north] : null
}

/**
 * Fits all routes inside the visible area when a plan arrives (design 8.5) and returns `fit` for
 * the Fit routes button. Padding changes alone do not move the camera.
 */
export function useFitRoutes(
  plan: Plan | null,
  padding: PaddingOptions,
  fitToPadding: (bounds: Bounds, padding: PaddingOptions) => void,
) {
  const bounds = useMemo(() => planBounds(plan), [plan])
  const paddingRef = useRef(padding)
  useEffect(() => {
    paddingRef.current = padding
  }, [padding])

  const fit = useCallback(() => {
    if (bounds) fitToPadding(bounds, paddingRef.current)
  }, [bounds, fitToPadding])

  // A new plan (or a map that became ready) refits; padding changes alone do not move the camera.
  useEffect(fit, [fit])

  return { canFit: bounds !== null, fit }
}
