import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { Marker } from 'maplibre-gl'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { CHIP_COMPACT_ZOOM } from '../../lib/constants'
import { rankLabel, shortRankLabel } from '../../lib/routeLabel'
import { decodePolyline } from '../../lib/polyline'
import { formatDuration } from '../../lib/units'
import type { Plan } from '../../lib/types'
import { lineMidpoint } from '../geo'
import { DestinationMarker, OriginMarker, RouteChip } from '../RouteChip'

type Position = [number, number]

interface ChipMarker {
  routeId: string
  marker: Marker
  root: Root
}

interface Endpoints {
  origin: Position
  destination: Position
}

function makeMarker(map: MapLibreMap, lngLat: Position, interactive: boolean) {
  const element = document.createElement('div')
  if (!interactive) element.style.pointerEvents = 'none'
  const marker = new Marker({ element, anchor: 'center' }).setLngLat(lngLat).addTo(map)
  return { marker, root: createRoot(element), element }
}

/** Unmounting waits a tick: React refuses to unmount a root while it is rendering. */
function dispose(root: Root, marker: Marker) {
  marker.remove()
  setTimeout(() => root.unmount(), 0)
}

/**
 * HTML markers: origin and destination (the ends of the 1st best line), and one chip per route at
 * the midpoint of its line (design 8.5). Built once per set of routes; selection only re-renders
 * the chips, so a focused chip keeps its focus. Zoomed far out, the chips show only "1st", "2nd",
 * "3rd", so they don't cover the lines (Step-14b).
 */
export function useRouteMarkers(
  map: MapLibreMap | null,
  plan: Plan | null,
  routeId: string | null,
  onSelectRoute: (routeId: string) => void,
) {
  const chips = useRef<ChipMarker[]>([])
  const [compact, setCompact] = useState(false)
  const latest = useRef({ routeId, onSelectRoute })
  useEffect(() => {
    latest.current = { routeId, onSelectRoute }
  })

  // Route geometry only: an update that keeps the routes keeps the markers.
  const linesKey = plan ? plan.routes.map((route) => route.line).join('\n') : ''
  const shape = useMemo(() => {
    if (!plan) return null
    const decoded = plan.routes.map((route) => ({ id: route.id, line: decodePolyline(route.line) }))
    const first = decoded[0]?.line
    if (!first || first.length === 0) return null
    const endpoints: Endpoints = { origin: first[0], destination: first[first.length - 1] }
    const mids = decoded.map(({ id, line }) => ({ id, at: lineMidpoint(line) }))
    return { endpoints, mids }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the lines, not the plan
  }, [linesKey])

  useEffect(() => {
    if (!map || !shape) return
    const origin = makeMarker(map, shape.endpoints.origin, false)
    origin.root.render(<OriginMarker />)
    const destination = makeMarker(map, shape.endpoints.destination, false)
    destination.root.render(<DestinationMarker />)
    chips.current = shape.mids.flatMap(({ id, at }) => {
      if (!at) return []
      const { marker, root } = makeMarker(map, at, true)
      return [{ routeId: id, marker, root }]
    })
    return () => {
      dispose(origin.root, origin.marker)
      dispose(destination.root, destination.marker)
      for (const chip of chips.current) dispose(chip.root, chip.marker)
      chips.current = []
    }
  }, [map, shape])

  // React skips the render when the zoom stays on the same side of the threshold.
  useEffect(() => {
    if (!map) return
    const update = () => setCompact(map.getZoom() < CHIP_COMPACT_ZOOM)
    update()
    map.on('zoom', update)
    return () => {
      map.off('zoom', update)
    }
  }, [map])

  // Render the chips again when the selection, the ranks, the travel times or the zoom change.
  useEffect(() => {
    if (!plan) return
    for (const chip of chips.current) {
      const route = plan.routes.find((r) => r.id === chip.routeId)
      if (!route) continue
      const selected = route.id === routeId
      chip.marker.getElement().style.zIndex = selected ? '2' : '1'
      chip.root.render(
        <RouteChip
          rank={rankLabel(route.rank)}
          shortRank={shortRankLabel(route.rank)}
          compact={compact}
          travelTime={formatDuration(route.travel_s / 60)}
          selected={selected}
          onSelect={() => latest.current.onSelectRoute(route.id)}
        />,
      )
    }
  }, [plan, routeId, shape, compact])
}
