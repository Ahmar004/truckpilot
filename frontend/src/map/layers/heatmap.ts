import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import type { FeatureCollection, Polygon } from 'geojson'
import { Popup } from 'maplibre-gl'
import type { MapMouseEvent } from 'maplibre-gl'
import { useEffect, useMemo, useRef } from 'react'
import { RISK_LEVELS_ORDERED } from '../../lib/constants'
import type { Theme } from '../../lib/constants'
import { cellTooltipText } from '../../lib/heatmapText'
import type { Heatmap, Plan } from '../../lib/types'
import { HEAT_OPACITY, MAP_PALETTE } from '../mapTheme'
import { CHECKPOINT_HIT_LAYER } from './checkpoints'
import { FIRST_ROUTE_LAYER, ROUTE_HIT_LAYER } from './routes'

const SOURCE = 'heatmap'
const LAYER = 'heatmap-fill'
const CELL_KEY = 'cell'
const LEVELS = 'lv'
const TRANSPARENT = 'rgba(0, 0, 0, 0)'
const TOOLTIP_OFFSET_PX = 8

type CellCollection = FeatureCollection<Polygon, { cell: string; lv: string }>

const cellKey = (i: number, j: number) => `${i},${j}`

/**
 * One square per cell. The server's i is floor(lat / cell_deg) and j is floor(lon / cell_deg),
 * so the south-west corner is at latitude i * cell_deg and longitude j * cell_deg.
 */
function toCollection(heatmap: Heatmap | null): CellCollection {
  const size = heatmap?.cell_deg ?? 0
  return {
    type: 'FeatureCollection',
    features: (heatmap?.cells ?? []).map(({ i, j, lv }) => {
      const south = i * size
      const west = j * size
      const north = south + size
      const east = west + size
      return {
        type: 'Feature',
        properties: { [CELL_KEY]: cellKey(i, j), [LEVELS]: lv },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [west, south],
              [east, south],
              [east, north],
              [west, north],
              [west, south],
            ],
          ],
        },
      }
    }),
  }
}

/** The character of the cell's 49-hour string at this hour. */
function levelAt(hour: number): ExpressionSpecification {
  return ['slice', ['get', LEVELS], hour, hour + 1]
}

function colorAt(theme: Theme, hour: number): ExpressionSpecification {
  const palette = MAP_PALETTE[theme].risk
  const pairs = RISK_LEVELS_ORDERED.flatMap((level, index) => [String(index), palette[level]])
  return ['match', levelAt(hour), ...pairs, TRANSPARENT] as ExpressionSpecification
}

function opacityAt(hour: number): ExpressionSpecification {
  const pairs = RISK_LEVELS_ORDERED.flatMap((level, index) => [String(index), HEAT_OPACITY[level]])
  return ['match', levelAt(hour), ...pairs, 0] as ExpressionSpecification
}

function addLayer(map: MapLibreMap, theme: Theme, hour: number, visible: boolean) {
  if (!map.getSource(SOURCE)) {
    map.addSource(SOURCE, { type: 'geojson', data: toCollection(null) })
  }
  if (map.getLayer(LAYER)) return
  map.addLayer(
    {
      id: LAYER,
      type: 'fill',
      source: SOURCE,
      layout: { visibility: visible ? 'visible' : 'none' },
      paint: {
        'fill-color': colorAt(theme, hour),
        'fill-opacity': opacityAt(hour),
        'fill-antialias': false,
      },
    },
    map.getLayer(FIRST_ROUTE_LAYER) ? FIRST_ROUTE_LAYER : undefined,
  )
}

/**
 * The heatmap (architecture 12.5): one GeoJSON source of cell squares built once per plan, each
 * carrying its 49-character level string. The slider only repaints: the fill color and opacity
 * read the character at the current hour, so a move is two paint calls and no request.
 */
export function useHeatmapLayer(
  map: MapLibreMap | null,
  styleVersion: number,
  theme: Theme,
  plan: Plan | null,
  hour: number,
  showHeatmap: boolean,
) {
  const heatmap = plan?.heatmap ?? null
  const collection = useMemo(() => toCollection(heatmap), [heatmap])
  const latest = useRef({ theme, hour, showHeatmap, collection })
  useEffect(() => {
    latest.current = { theme, hour, showHeatmap, collection }
  })

  // After every style load the layer is added again (a theme change drops it).
  useEffect(() => {
    if (!map || styleVersion === 0) return
    const { theme: current, hour: at, showHeatmap: visible, collection: data } = latest.current
    addLayer(map, current, at, visible)
    ;(map.getSource(SOURCE) as GeoJSONSource).setData(data)
  }, [map, styleVersion])

  useEffect(() => {
    if (!map || styleVersion === 0) return
    ;(map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(collection)
  }, [map, styleVersion, collection])

  useEffect(() => {
    if (!map || styleVersion === 0 || !map.getLayer(LAYER)) return
    map.setPaintProperty(LAYER, 'fill-color', colorAt(theme, hour))
    map.setPaintProperty(LAYER, 'fill-opacity', opacityAt(hour))
  }, [map, styleVersion, theme, hour])

  useEffect(() => {
    if (!map || styleVersion === 0 || !map.getLayer(LAYER)) return
    map.setLayoutProperty(LAYER, 'visibility', showHeatmap ? 'visible' : 'none')
  }, [map, styleVersion, showHeatmap])
}

/**
 * The cell tooltip: hover on desktop, tap on a phone. Plain text in a MapLibre Popup that
 * follows the slider hour. A tap on a Checkpoint or a route line is theirs, not the heatmap's.
 */
export function useHeatmapTooltip(
  map: MapLibreMap | null,
  styleVersion: number,
  plan: Plan | null,
  hour: number,
  showHeatmap: boolean,
  isDesktop: boolean,
) {
  const popup = useRef<Popup | null>(null)
  const open = useRef<string | null>(null)
  const cells = useMemo(
    () => new Map((plan?.heatmap?.cells ?? []).map((c) => [cellKey(c.i, c.j), c])),
    [plan],
  )
  const latest = useRef({ plan, hour, cells })
  useEffect(() => {
    latest.current = { plan, hour, cells }
  })

  useEffect(() => {
    if (!map || styleVersion === 0) return
    const close = () => {
      popup.current?.remove()
      popup.current = null
      open.current = null
    }
    const show = (event: MapMouseEvent) => {
      if (!map.getLayer(LAYER) || !showHeatmap) return close()
      const taken = [CHECKPOINT_HIT_LAYER, ROUTE_HIT_LAYER].filter((id) => map.getLayer(id))
      if (taken.length > 0 && map.queryRenderedFeatures(event.point, { layers: taken }).length > 0)
        return close()
      const feature = map.queryRenderedFeatures(event.point, { layers: [LAYER] })[0]
      const key = feature?.properties?.[CELL_KEY]
      const cell = typeof key === 'string' ? latest.current.cells.get(key) : undefined
      if (!cell || !latest.current.plan) return close()
      const text = cellTooltipText(cell, latest.current.plan, latest.current.hour)
      if (!popup.current) {
        popup.current = new Popup({
          closeButton: false,
          closeOnClick: false,
          closeOnMove: false,
          focusAfterOpen: false,
          maxWidth: 'none',
          offset: TOOLTIP_OFFSET_PX,
          className: 'tp-popup tp-tip',
        })
      }
      open.current = key as string
      popup.current.setLngLat(event.lngLat).setText(text).addTo(map)
    }
    if (isDesktop) map.on('mousemove', show)
    map.on('click', show)
    map.on('mouseout', close)
    return () => {
      map.off('mouseout', close)
      map.off('mousemove', show)
      map.off('click', show)
      close()
    }
  }, [map, styleVersion, showHeatmap, isDesktop])

  // The tooltip follows the slider while it is open.
  useEffect(() => {
    const key = open.current
    const cell = key ? cells.get(key) : undefined
    if (cell && plan && popup.current) popup.current.setText(cellTooltipText(cell, plan, hour))
  }, [plan, hour, cells])
}
