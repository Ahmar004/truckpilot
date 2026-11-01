import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { PaddingOptions } from 'maplibre-gl'
import { decodePolyline } from '../lib/polyline'
import type { Plan } from '../lib/types'

type Bounds = [number, number, number, number]

/** Separates encoded lines in a key: polyline characters never include a newline. */
const LINE_SEPARATOR = '\n'

/** Bounds of the given encoded lines: [west, south, east, north], or null with none. */
function linesBounds(lines: string[]): Bounds | null {
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  for (const line of lines) {
    for (const [lng, lat] of decodePolyline(line)) {
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
  // Keyed on the lines, not the plan: an interval or HOS update keeps the routes, so the camera stays.
  const linesKey = plan ? plan.routes.map((route) => route.line).join(LINE_SEPARATOR) : ''
  const bounds = useMemo(
    () => (linesKey ? linesBounds(linesKey.split(LINE_SEPARATOR)) : null),
    [linesKey],
  )
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
