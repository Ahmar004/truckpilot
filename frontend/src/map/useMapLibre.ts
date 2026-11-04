import { useCallback, useEffect, useRef, useState } from 'react'
import { Map as MapLibreMap, setWorkerUrl } from 'maplibre-gl'
// MapLibre 6 loads its worker from a file next to its own module; once Vite bundles the module
// that file is gone, so the worker is emitted as an asset and its URL set here (Step-14 fix 1).
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import type { PaddingOptions } from 'maplibre-gl'
import type { Theme } from '../lib/constants'
import { MAP_STYLE_URL, OVERVIEW_BOUNDS } from './mapTheme'

setWorkerUrl(workerUrl)

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Camera options for animated moves: no animation under reduced motion (design 8.5). */
export function cameraOptions() {
  return prefersReducedMotion() ? { duration: 0 } : {}
}

/**
 * Creates the map once in the container and keeps its style in step with the theme.
 * Layer hooks depend on `map` and `styleVersion`: a style switch drops every layer, so they add
 * theirs again whenever `styleVersion` changes (architecture 12.5).
 */
export function useMapLibre(container: React.RefObject<HTMLDivElement | null>, theme: Theme) {
  const [map, setMap] = useState<MapLibreMap | null>(null)
  const [styleVersion, setStyleVersion] = useState(0)
  const styleUrlRef = useRef(MAP_STYLE_URL[theme])

  useEffect(() => {
    const element = container.current
    if (!element) return
    const instance = new MapLibreMap({
      container: element,
      style: styleUrlRef.current,
      bounds: OVERVIEW_BOUNDS,
      // The data credits are in the guide page's footer (Step-14b).
      attributionControl: false,
      pitchWithRotate: false,
      dragRotate: false,
      touchPitch: false,
      maxPitch: 0,
    })
    instance.touchZoomRotate.disableRotation()
    instance.keyboard.disableRotation()
    const onStyleLoad = () => setStyleVersion((version) => version + 1)
    instance.on('style.load', onStyleLoad)
    setMap(instance)
    return () => {
      instance.off('style.load', onStyleLoad)
      instance.remove()
      setMap(null)
    }
  }, [container])

  useEffect(() => {
    if (!map) return
    const url = MAP_STYLE_URL[theme]
    // The map was created with the current style; only a real theme change switches it.
    if (url === styleUrlRef.current) return
    styleUrlRef.current = url
    map.setStyle(url)
  }, [map, theme])

  const zoomIn = useCallback(() => map?.zoomIn(cameraOptions()), [map])
  const zoomOut = useCallback(() => map?.zoomOut(cameraOptions()), [map])

  /** Fit [west, south, east, north] inside the area the panel or sheet leaves visible. */
  const fitToPadding = useCallback(
    (bounds: [number, number, number, number], padding: PaddingOptions) => {
      map?.fitBounds(bounds, { padding, ...cameraOptions() })
    },
    [map],
  )

  return { map, styleVersion, zoomIn, zoomOut, fitToPadding }
}
