import { useRef } from 'react'
import type { PaddingOptions } from 'maplibre-gl'
import type { Theme, UnitSystem } from '../lib/constants'
import type { Plan } from '../lib/types'
import { useCheckpointLayer } from './layers/checkpoints'
import { useCheckpointPopup } from './layers/checkpointPopup'
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
  /** Selected Checkpoint number. */
  checkpointN: number | null
  /** Forecast hour 0-48 (slice 13). */
  hour: number
  showHeatmap: boolean
  theme: Theme
  units: UnitSystem
  /** Desktop opens a Checkpoint in a pop-up; a phone shows it in the sheet. */
  isDesktop: boolean
  /** Space the panel or sheet covers; the controls and the fit stay clear of it. */
  padding: PaddingOptions
  onSelectRoute: (routeId: string) => void
  onSelectCheckpoint: (n: number) => void
  onCloseCheckpoint: () => void
}

/**
 * The map. Props in, callbacks out; it fetches nothing. The routes layer, the Checkpoints with their pop-up, and the route
 * chips and end markers are drawn here; the heatmap and truck hooks (slices 14-15) join below
 * with `map` and `styleVersion` from `useMapLibre`.
 */
export default function PlannerMap({
  plan,
  routeId,
  checkpointN,
  theme,
  units,
  isDesktop,
  padding,
  onSelectRoute,
  onSelectCheckpoint,
  onCloseCheckpoint,
}: PlannerMapProps) {
  const container = useRef<HTMLDivElement>(null)
  const { map, styleVersion, zoomIn, zoomOut, fitToPadding } = useMapLibre(container, theme)
  useRouteLayer(map, styleVersion, theme, plan, routeId, onSelectRoute)
  useCheckpointLayer(map, styleVersion, theme, plan, routeId, checkpointN, onSelectCheckpoint)
  useRouteMarkers(map, plan, routeId, onSelectRoute)
  const openCheckpoint =
    plan?.routes
      .find((route) => route.id === routeId)
      ?.checkpoints.find((c) => c.n === checkpointN) ?? null
  useCheckpointPopup(
    map,
    openCheckpoint,
    plan?.trip.load ?? null,
    units,
    isDesktop,
    padding,
    onCloseCheckpoint,
  )
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
