import type { CSSProperties } from 'react'
import { ArrowsOut, Minus, Plus } from '../components/ui/icons'
import { Button } from '../components/ui/Button'

interface MapControlsProps {
  /** Fit routes is hidden when there is no plan to fit. */
  canFit: boolean
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  /** Offsets that keep the column clear of the panel, the sheet and the attribution. */
  style?: CSSProperties
}

/** Zoom in, zoom out and Fit routes, a column in the map's bottom-right corner (design 8.5). */
export function MapControls({ canFit, onZoomIn, onZoomOut, onFit, style }: MapControlsProps) {
  return (
    <div className="absolute z-10 flex flex-col gap-2" style={style}>
      <Button
        variant="secondary"
        className="size-10 !p-0 shadow-card"
        aria-label="Zoom in"
        onClick={onZoomIn}
      >
        <Plus size={20} weight="bold" aria-hidden />
      </Button>
      <Button
        variant="secondary"
        className="size-10 !p-0 shadow-card"
        aria-label="Zoom out"
        onClick={onZoomOut}
      >
        <Minus size={20} weight="bold" aria-hidden />
      </Button>
      {canFit && (
        <Button
          variant="secondary"
          className="size-10 !p-0 shadow-card"
          aria-label="Fit routes"
          onClick={onFit}
        >
          <ArrowsOut size={20} weight="bold" aria-hidden />
        </Button>
      )}
    </div>
  )
}
