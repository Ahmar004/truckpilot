import { useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { Marker } from 'maplibre-gl'
import type { Map as MapLibreMap } from 'maplibre-gl'
import type { TruckPosition } from '../../lib/types'
import { TruckMarker } from '../RouteChip'

/**
 * The truck on the selected route at the slider's hour (design 8.5). It jumps to each hour, so
 * reduced motion needs nothing more. It stays put during breaks and at the destination: the
 * server repeats the position for those hours.
 */
export function useTruckMarker(map: MapLibreMap | null, truck: TruckPosition | null) {
  const marker = useRef<Marker | null>(null)
  const present = truck !== null
  const lon = truck?.lon
  const lat = truck?.lat

  // Created before the position effect below runs, so the first position lands on it.
  useEffect(() => {
    if (!map || !present) return
    const element = document.createElement('div')
    element.style.pointerEvents = 'none'
    element.style.zIndex = '3'
    const created = new Marker({ element, anchor: 'center' }).setLngLat([0, 0]).addTo(map)
    const root = createRoot(element)
    root.render(<TruckMarker />)
    marker.current = created
    return () => {
      created.remove()
      marker.current = null
      setTimeout(() => root.unmount(), 0)
    }
  }, [map, present])

  useEffect(() => {
    if (lon === undefined || lat === undefined) return
    marker.current?.setLngLat([lon, lat])
  }, [lon, lat, map, present])
}
