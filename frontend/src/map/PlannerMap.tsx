import { useRef } from 'react'
import type { PaddingOptions } from 'maplibre-gl'
import type { Theme } from '../lib/constants'
import type { Plan } from '../lib/types'
import { useRouteLayer } from './layers/routes'
import { useRouteMarkers } from './layers/routeMarkers'
import { MapControls } from './MapControls'
import { useFitRoutes } from './useFitRoutes'
import { useMapLibre } from './useMapLibre'
import './map.css'

export interface PlannerMapProps {
  plan: Plan | null
  /** Selected route (slice 12). */
  routeId: string | null
  /** Selected Checkpoint number (slice 14). */
  checkpointN: number | null
  /** Forecast hour 0-48 (slice 13). */
  hour: number
  showHeatmap: boolean
  theme: Theme
  /** Space the panel or sheet covers; the controls and the fit stay clear of it. */
  padding: PaddingOptions
  onSelectRoute: (routeId: string) => void
  onSelectCheckpoint: (n: number) => void
}

/**
 * The map. Props in, callbacks out; it fetches nothing. The routes layer and the route chips and
 * end markers are drawn here; the heatmap, checkpoint and truck hooks (slices 13-15) join below
 * with `map` and `styleVersion` from `useMapLibre`.
 */
export default function PlannerMap({
  plan,
  routeId,
  theme,
  padding,
  onSelectRoute,
}: PlannerMapProps) {
  const container = useRef<HTMLDivElement>(null)
  const { map, styleVersion, zoomIn, zoomOut, fitToPadding } = useMapLibre(container, theme)
  useRouteLayer(map, styleVersion, theme, plan, routeId, onSelectRoute)
  useRouteMarkers(map, plan, routeId, onSelectRoute)
  const { canFit, fit } = useFitRoutes(map ? plan : null, padding, fitToPadding)

  return (
    <div className="relative size-full overflow-hidden">
      <div ref={container} className="size-full" role="application" aria-label="Route map" />
      <MapControls
        canFit={canFit}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onFit={fit}
        style={{ right: (padding.right ?? 0) + 10, bottom: (padding.bottom ?? 0) + 40 }}
      />
    </div>
  )
}
