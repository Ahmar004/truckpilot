import { useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { Popup } from 'maplibre-gl'
import type { Map as MapLibreMap, PaddingOptions } from 'maplibre-gl'
import { CHECKPOINT_PAN_MARGIN_PX, CHECKPOINT_POPUP_CLEARANCE_PX } from '../../lib/constants'
import type { UnitSystem } from '../../lib/constants'
import type { Checkpoint, Load } from '../../lib/types'
import { CheckpointPopup } from '../CheckpointPopup'
import { cameraOptions } from '../useMapLibre'

/** Offset above the marker, past the selected ring, in px. */
const POPUP_OFFSET_PX = 16

/** Pan only when the Checkpoint is not already inside the area the panel or sheet leaves visible. */
function panIntoView(
  map: MapLibreMap,
  checkpoint: Checkpoint,
  padding: PaddingOptions,
  popupOpen: boolean,
) {
  const { x, y } = map.project([checkpoint.lon, checkpoint.lat])
  const { clientWidth: width, clientHeight: height } = map.getContainer()
  const margin = CHECKPOINT_PAN_MARGIN_PX
  const top = (padding.top ?? 0) + margin + (popupOpen ? CHECKPOINT_POPUP_CLEARANCE_PX : 0)
  const inside =
    x >= (padding.left ?? 0) + margin &&
    x <= width - (padding.right ?? 0) - margin &&
    y >= top &&
    y <= height - (padding.bottom ?? 0) - margin
  if (inside) return
  // Put it in the middle of the visible area (an offset leaves the map's own padding alone).
  const centerX = ((padding.left ?? 0) + width - (padding.right ?? 0)) / 2
  const centerY = (top + height - (padding.bottom ?? 0)) / 2
  map.easeTo({
    center: [checkpoint.lon, checkpoint.lat],
    offset: [centerX - width / 2, centerY - height / 2],
    ...cameraOptions(),
  })
}

/**
 * The open Checkpoint on the map. Desktop: a Popup above the marker whose content is a React root
 * (plain text only). A phone shows the detail in the sheet instead. Both pan the Checkpoint into
 * the visible area. The root is unmounted when the Popup closes.
 */
export function useCheckpointPopup(
  map: MapLibreMap | null,
  checkpoint: Checkpoint | null,
  load: Load | null,
  units: UnitSystem,
  isDesktop: boolean,
  padding: PaddingOptions,
  onClose: () => void,
) {
  const latest = useRef({ padding, onClose })
  useEffect(() => {
    latest.current = { padding, onClose }
  })

  // Pan once per opened Checkpoint, not on every padding change.
  const n = checkpoint?.n ?? null
  useEffect(() => {
    if (!map || !checkpoint) return
    panIntoView(map, checkpoint, latest.current.padding, isDesktop)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the Checkpoint number
  }, [map, n, isDesktop])

  useEffect(() => {
    if (!map || !checkpoint || !load || !isDesktop) return
    const element = document.createElement('div')
    const root = createRoot(element)
    root.render(
      <CheckpointPopup
        checkpoint={checkpoint}
        load={load}
        units={units}
        onClose={() => latest.current.onClose()}
      />,
    )
    const popup = new Popup({
      closeButton: false,
      closeOnClick: false,
      closeOnMove: false,
      focusAfterOpen: false,
      maxWidth: 'none',
      offset: POPUP_OFFSET_PX,
      className: 'tp-popup',
    })
      .setLngLat([checkpoint.lon, checkpoint.lat])
      .setDOMContent(element)
      .addTo(map)
    return () => {
      popup.remove()
      setTimeout(() => root.unmount(), 0)
    }
  }, [map, checkpoint, load, units, isDesktop])
}
