import { useEffect, useRef } from 'react'
import type { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl'

const PICKING_CLASS = 'tp-picking'

/**
 * "Choose on map" (Step-14b): while `active`, the map shows a crosshair and a click on it hands
 * the point to `onPick`. The lookup and what happens next live in `usePlacePick`.
 */
export function useMapPick(
  map: MapLibreMap | null,
  active: boolean,
  onPick: (lat: number, lon: number) => void,
) {
  const latest = useRef(onPick)
  useEffect(() => {
    latest.current = onPick
  })

  useEffect(() => {
    if (!map || !active) return
    const container = map.getContainer()
    container.classList.add(PICKING_CLASS)
    const onClick = (event: MapMouseEvent) => {
      if (event.originalEvent.target !== map.getCanvas()) return
      latest.current(event.lngLat.lat, event.lngLat.lng)
    }
    map.on('click', onClick)
    return () => {
      container.classList.remove(PICKING_CLASS)
      map.off('click', onClick)
    }
  }, [map, active])
}
