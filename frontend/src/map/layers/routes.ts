import type { FeatureCollection, LineString } from 'geojson'
import { useEffect, useMemo, useRef } from 'react'
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent } from 'maplibre-gl'
import { decodePolyline } from '../../lib/polyline'
import type { Theme } from '../../lib/constants'
import type { Plan } from '../../lib/types'
import { MAP_PALETTE } from '../mapTheme'

const SOURCE = 'routes'
const LAYER = {
  ALT: 'routes-alt',
  CASING: 'routes-casing',
  SELECTED: 'routes-selected',
  HIT: 'routes-hit',
} as const
/** Id of the lowest route layer; the heatmap sits below it. */
export const FIRST_ROUTE_LAYER = LAYER.ALT
/** Route hit line, for telling a route tap from a heatmap tap. */
export const ROUTE_HIT_LAYER = LAYER.HIT
const SELECTED_LAYERS = [LAYER.CASING, LAYER.SELECTED]
const ROUTE_ID = 'routeId'
/** Width of the invisible line that takes taps and clicks, in px. */
const HIT_WIDTH = 24

type RouteCollection = FeatureCollection<LineString, { routeId: string }>

function toCollection(plan: Plan | null): RouteCollection {
  return {
    type: 'FeatureCollection',
    features: (plan?.routes ?? []).map((route) => ({
      type: 'Feature',
      properties: { routeId: route.id },
      geometry: { type: 'LineString', coordinates: decodePolyline(route.line) },
    })),
  }
}

function addLayers(map: MapLibreMap, theme: Theme) {
  const palette = MAP_PALETTE[theme]
  if (!map.getSource(SOURCE)) {
    map.addSource(SOURCE, { type: 'geojson', data: toCollection(null) })
  }
  const layout = { 'line-cap': 'round', 'line-join': 'round' } as const
  if (!map.getLayer(LAYER.ALT)) {
    map.addLayer({
      id: LAYER.ALT,
      type: 'line',
      source: SOURCE,
      layout,
      paint: { 'line-color': palette.routeAlt, 'line-width': 5 },
    })
  }
  if (!map.getLayer(LAYER.CASING)) {
    map.addLayer({
      id: LAYER.CASING,
      type: 'line',
      source: SOURCE,
      layout,
      paint: { 'line-color': palette.routeCasing, 'line-width': 10 },
    })
  }
  if (!map.getLayer(LAYER.SELECTED)) {
    map.addLayer({
      id: LAYER.SELECTED,
      type: 'line',
      source: SOURCE,
      layout,
      paint: { 'line-color': palette.routeSelected, 'line-width': 6 },
    })
  }
  if (!map.getLayer(LAYER.HIT)) {
    map.addLayer({
      id: LAYER.HIT,
      type: 'line',
      source: SOURCE,
      layout,
      paint: { 'line-color': '#000000', 'line-width': HIT_WIDTH, 'line-opacity': 0 },
    })
  }
}

function applySelection(map: MapLibreMap, routeId: string | null) {
  const id = routeId ?? ''
  map.setFilter(LAYER.ALT, ['!=', ['get', ROUTE_ID], id])
  for (const layer of SELECTED_LAYERS) map.setFilter(layer, ['==', ['get', ROUTE_ID], id])
}

/**
 * The routes layer (architecture 12.5): one GeoJSON source of every shown route, the others in
 * `--route-alt`, the selected one drawn by a filter on `routeId`, plus a wide invisible line that
 * takes clicks and taps. Layers are added again whenever the style reloads (theme change).
 */
export function useRouteLayer(
  map: MapLibreMap | null,
  styleVersion: number,
  theme: Theme,
  plan: Plan | null,
  routeId: string | null,
  onSelectRoute: (routeId: string) => void,
) {
  const collection = useMemo(() => toCollection(plan), [plan])
  const latest = useRef({ theme, routeId, collection, onSelectRoute })
  useEffect(() => {
    latest.current = { theme, routeId, collection, onSelectRoute }
  })

  // After every style load the layers are added again; the theme is read when the style is ready.
  useEffect(() => {
    if (!map || styleVersion === 0) return
    const { theme: current, collection: data, routeId: selected } = latest.current
    addLayers(map, current)
    ;(map.getSource(SOURCE) as GeoJSONSource).setData(data)
    applySelection(map, selected)
  }, [map, styleVersion])

  useEffect(() => {
    if (!map || styleVersion === 0) return
    ;(map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(collection)
  }, [map, styleVersion, collection])

  useEffect(() => {
    if (!map || styleVersion === 0) return
    applySelection(map, routeId)
  }, [map, styleVersion, routeId])

  useEffect(() => {
    if (!map) return
    const onClick = (event: MapLayerMouseEvent) => {
      const id = event.features?.[0]?.properties?.[ROUTE_ID]
      if (typeof id === 'string') latest.current.onSelectRoute(id)
    }
    const pointer = () => {
      map.getCanvas().style.cursor = 'pointer'
    }
    const arrow = () => {
      map.getCanvas().style.cursor = ''
    }
    map.on('click', LAYER.HIT, onClick)
    map.on('mouseenter', LAYER.HIT, pointer)
    map.on('mouseleave', LAYER.HIT, arrow)
    return () => {
      map.off('click', LAYER.HIT, onClick)
      map.off('mouseenter', LAYER.HIT, pointer)
      map.off('mouseleave', LAYER.HIT, arrow)
    }
  }, [map])
}
