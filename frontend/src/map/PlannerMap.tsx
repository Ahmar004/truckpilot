import { useRef } from 'react'
import type { PaddingOptions } from 'maplibre-gl'
import { ForecastSlider } from '../features/planner/ForecastSlider'
import { useForecastSlider } from '../features/planner/useForecastSlider'
import { SLIDER_CLEARANCE_PX } from '../lib/constants'
import type { PickStatus, Theme, UnitSystem } from '../lib/constants'
import type { Plan } from '../lib/types'
import { useHeatmapLayer, useHeatmapTooltip } from './layers/heatmap'
import { useCheckpointLayer } from './layers/checkpoints'
import { useCheckpointPopup } from './layers/checkpointPopup'
import { useRouteLayer } from './layers/routes'
import { useRouteMarkers } from './layers/routeMarkers'
import { useTruckMarker } from './layers/truckMarker'
import { MapLegend } from './MapLegend'
import { MapControls } from './MapControls'
import { MapPickBar } from './MapPickBar'
import { useFitRoutes } from './useFitRoutes'
import { useMapLibre } from './useMapLibre'
import { useMapPick } from './useMapPick'
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
  onHourChange: (hour: number) => void
  onShowHeatmapChange: (show: boolean) => void
  onSelectRoute: (routeId: string) => void
  onSelectCheckpoint: (n: number) => void
  onCloseCheckpoint: () => void
  /** "Choose on map" in progress (Step-14b), or null. */
  pick: { fieldLabel: string; status: PickStatus; retryAfterMin?: number } | null
  onPickPoint: (lat: number, lon: number) => void
  onCancelPick: () => void
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
  hour,
  showHeatmap,
  theme,
  units,
  isDesktop,
  padding,
  onHourChange,
  onShowHeatmapChange,
  onSelectRoute,
  onSelectCheckpoint,
  onCloseCheckpoint,
  pick,
  onPickPoint,
  onCancelPick,
}: PlannerMapProps) {
  const container = useRef<HTMLDivElement>(null)
  const { map, styleVersion, zoomIn, zoomOut, fitToPadding } = useMapLibre(container, theme)
  useHeatmapLayer(map, styleVersion, theme, plan, hour, showHeatmap)
  useHeatmapTooltip(map, styleVersion, plan, hour, showHeatmap, isDesktop)
  useRouteLayer(map, styleVersion, theme, plan, routeId, onSelectRoute)
  useCheckpointLayer(
    map,
    styleVersion,
    theme,
    plan,
    routeId,
    checkpointN,
    onSelectCheckpoint,
    onCloseCheckpoint,
  )
  useMapPick(map, pick !== null, onPickPoint)
  useRouteMarkers(map, plan, routeId, onSelectRoute)
  const selectedRoute = plan?.routes.find((route) => route.id === routeId) ?? null
  const slider = useForecastSlider(plan, selectedRoute, hour, units, onHourChange)
  useTruckMarker(map, selectedRoute?.truck[slider.hour] ?? null)
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

  // On a phone the slider spans the width, so the controls and the legend sit above it.
  const above = plan && !isDesktop ? SLIDER_CLEARANCE_PX : 0
  const bottom = (padding.bottom ?? 0) + above
  return (
    <div className="relative size-full overflow-hidden">
      <div ref={container} className="size-full" role="application" aria-label="Route map" />
      {pick && (
        <MapPickBar
          fieldLabel={pick.fieldLabel}
          status={pick.status}
          retryAfterMin={pick.retryAfterMin}
          isDesktop={isDesktop}
          onCancel={onCancelPick}
          style={{
            top: (padding.top ?? 0) + 10,
            left: (padding.left ?? 0) + 10,
            right: (padding.right ?? 0) + 10,
          }}
        />
      )}
      <MapControls
        canFit={canFit}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onFit={fit}
        style={{ right: (padding.right ?? 0) + 10, bottom: bottom + 40 }}
      />
      {plan && (
        <ForecastSlider
          hour={slider.hour}
          valueText={slider.valueText}
          ariaValueText={slider.ariaValueText}
          onHourChange={slider.setHour}
          onKeyDownCapture={slider.onKeyDownCapture}
          style={{
            left: (padding.left ?? 0) + 10,
            right: (padding.right ?? 0) + (isDesktop ? 60 : 10),
            bottom: (padding.bottom ?? 0) + 28,
          }}
        />
      )}
      {plan?.heatmap && (
        <MapLegend
          showHeatmap={showHeatmap}
          defaultOpen={isDesktop}
          onShowHeatmapChange={onShowHeatmapChange}
          style={{
            left: (padding.left ?? 0) + 10,
            bottom: isDesktop ? (padding.bottom ?? 0) + 28 : bottom,
          }}
        />
      )}
    </div>
  )
}
