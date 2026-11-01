import type { FeatureCollection, Point } from 'geojson'
import { useEffect, useMemo, useRef } from 'react'
import type {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
  MapLayerMouseEvent,
} from 'maplibre-gl'
import { RISK_LEVELS_ORDERED } from '../../lib/constants'
import type { Theme } from '../../lib/constants'
import type { Plan, Route } from '../../lib/types'
import { MAP_PALETTE } from '../mapTheme'

const SOURCE = 'checkpoints'
const LAYER = {
  SELECTED_RING: 'checkpoints-selected',
  DOT: 'checkpoints-dot',
  HIT: 'checkpoints-hit',
} as const
/** Checkpoint hit circle, for telling a Checkpoint tap from a heatmap tap. */
export const CHECKPOINT_HIT_LAYER = LAYER.HIT
const FIRST_LAYER = LAYER.SELECTED_RING
const N = 'n'
const LEVEL = 'level'
/** Level value of a Checkpoint with no weather data. */
const NO_DATA = 'none'
const DOT_RADIUS = 6
const SELECTED_RADIUS = 11
/** Radius of the invisible circle that takes taps, in px (a 32 px target, design 8.5). */
const HIT_RADIUS = 16

type CheckpointCollection = FeatureCollection<Point, { n: number; level: string }>

function toCollection(route: Route | null): CheckpointCollection {
  return {
    type: 'FeatureCollection',
    features: (route?.checkpoints ?? []).map((checkpoint) => ({
      type: 'Feature',
      properties: { n: checkpoint.n, level: checkpoint.level ?? NO_DATA },
      geometry: { type: 'Point', coordinates: [checkpoint.lon, checkpoint.lat] },
    })),
  }
}

function levelColor(theme: Theme): ExpressionSpecification {
  const palette = MAP_PALETTE[theme]
  const pairs = RISK_LEVELS_ORDERED.flatMap((level) => [level, palette.risk[level]])
  return ['match', ['get', LEVEL], ...pairs, palette.noData] as unknown as ExpressionSpecification
}

function addLayers(map: MapLibreMap, theme: Theme) {
  const palette = MAP_PALETTE[theme]
  if (!map.getSource(SOURCE)) {
    map.addSource(SOURCE, { type: 'geojson', data: toCollection(null) })
  }
  if (!map.getLayer(LAYER.SELECTED_RING)) {
    map.addLayer({
      id: LAYER.SELECTED_RING,
      type: 'circle',
      source: SOURCE,
      filter: ['==', ['get', N], -1],
      paint: {
        'circle-radius': SELECTED_RADIUS,
        'circle-opacity': 0,
        'circle-stroke-width': 3,
        'circle-stroke-color': palette.checkpointSelected,
      },
    })
  }
  if (!map.getLayer(LAYER.DOT)) {
    map.addLayer({
      id: LAYER.DOT,
      type: 'circle',
      source: SOURCE,
      paint: {
        'circle-radius': DOT_RADIUS,
        'circle-color': levelColor(theme),
        'circle-stroke-width': 2,
        'circle-stroke-color': palette.checkpointRing,
      },
    })
  }
  if (!map.getLayer(LAYER.HIT)) {
    map.addLayer({
      id: LAYER.HIT,
      type: 'circle',
      source: SOURCE,
      paint: { 'circle-radius': HIT_RADIUS, 'circle-color': '#000000', 'circle-opacity': 0 },
    })
  }
}

function applySelection(map: MapLibreMap, checkpointN: number | null) {
  map.setFilter(FIRST_LAYER, ['==', ['get', N], checkpointN ?? -1])
}

/**
 * The checkpoints layer (architecture 12.5): the selected route's Checkpoints as circles colored by
 * risk level with a ring that keeps them readable on both base maps, a larger ring on the selected
 * one, and an invisible wider circle that takes taps. Added again whenever the style reloads.
 */
export function useCheckpointLayer(
  map: MapLibreMap | null,
  styleVersion: number,
  theme: Theme,
  plan: Plan | null,
  routeId: string | null,
  checkpointN: number | null,
  onSelectCheckpoint: (n: number) => void,
) {
  const collection = useMemo(
    () => toCollection(plan?.routes.find((route) => route.id === routeId) ?? null),
    [plan, routeId],
  )
  const latest = useRef({ theme, checkpointN, collection, onSelectCheckpoint })
  useEffect(() => {
    latest.current = { theme, checkpointN, collection, onSelectCheckpoint }
  })

  useEffect(() => {
    if (!map || styleVersion === 0) return
    const { theme: current, collection: data, checkpointN: selected } = latest.current
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
    applySelection(map, checkpointN)
  }, [map, styleVersion, checkpointN])

  useEffect(() => {
    if (!map) return
    const onClick = (event: MapLayerMouseEvent) => {
      const n = event.features?.[0]?.properties?.[N]
      if (typeof n === 'number') latest.current.onSelectCheckpoint(n)
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
