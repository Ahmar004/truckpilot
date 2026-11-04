import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { MAP_TOP_PADDING_PX, SHEET, SHEET_DRAG_THRESHOLD_PX } from '../../lib/constants'
import type { SheetHeight } from '../../lib/constants'

const PEEK_REM = 7.5 // mirrors --sheet-peek
const TOP_GAP_REM = 4.5 // mirrors --sheet-top-gap
const PANEL_REM = 26 // mirrors --panel-w
const PANEL_EDGE_REM = 2 // left margin plus a gap, so the map fit clears the panel
const ORDER: SheetHeight[] = [SHEET.PEEK, SHEET.HALF, SHEET.FULL]

function remPx(): number {
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
}

/** The three snap heights in px for a viewport height (design 8.1). */
function snapHeights(viewport: number): Record<SheetHeight, number> {
  const rem = remPx()
  return {
    [SHEET.PEEK]: PEEK_REM * rem,
    [SHEET.HALF]: viewport * 0.5,
    [SHEET.FULL]: viewport - TOP_GAP_REM * rem,
  }
}

function nextHeight(current: SheetHeight): SheetHeight {
  return ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]
}

/**
 * The bottom sheet on a phone and the side panel on desktop: snap height, drag, and whether the
 * desktop panel is open. Local view state; nothing here is fetched or stored.
 */
export function useBottomSheet(initial: SheetHeight = SHEET.HALF) {
  const [height, setHeight] = useState<SheetHeight>(initial)
  const [panelOpen, setPanelOpen] = useState(true)
  const [viewport, setViewport] = useState(() => window.innerHeight)
  const [dragPx, setDragPx] = useState<number | null>(null)
  const drag = useRef<{ startY: number; startPx: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)

  useEffect(() => {
    const onResize = () => setViewport(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const snaps = snapHeights(viewport)
  const sheetPx = dragPx ?? snaps[height]

  const step = useCallback(() => setHeight(nextHeight), [])

  // "Choose on map" lowers the sheet so the map can be tapped, then puts it back (Step-14b).
  const before = useRef<SheetHeight | null>(null)
  const lower = useCallback(() => {
    setHeight((current) => {
      before.current ??= current
      return SHEET.PEEK
    })
  }, [])
  const restore = useCallback(() => {
    const saved = before.current
    before.current = null
    if (saved) setHeight(saved)
  }, [])
  const togglePanel = useCallback(() => setPanelOpen((open) => !open), [])

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { startY: event.clientY, startPx: snaps[height], moved: false }
  }
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d) return
    const delta = d.startY - event.clientY
    if (!d.moved && Math.abs(delta) < SHEET_DRAG_THRESHOLD_PX) return
    d.moved = true
    const lo = snaps[SHEET.PEEK]
    const hi = snaps[SHEET.FULL]
    setDragPx(Math.min(hi, Math.max(lo, d.startPx + delta)))
  }
  const onPointerEnd = () => {
    const d = drag.current
    drag.current = null
    if (!d?.moved) return
    suppressClick.current = true // the click that follows a drag must not also step
    const px = dragPx ?? d.startPx
    const nearest = ORDER.reduce((best, h) =>
      Math.abs(snaps[h] - px) < Math.abs(snaps[best] - px) ? h : best,
    )
    setHeight(nearest)
    setDragPx(null)
  }
  const onClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    step()
  }
  // Enter and Space already fire a click on a button, so the keyboard needs no extra handler.

  return {
    height,
    sheetPx,
    dragging: dragPx !== null,
    panelOpen,
    togglePanel,
    lower,
    restore,
    topPx: MAP_TOP_PADDING_PX,
    panelWidthPx: (PANEL_REM + PANEL_EDGE_REM) * remPx(),
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      onClick,
    },
  }
}
