import { useId, useState } from 'react'
import type { CSSProperties } from 'react'
import * as Switch from '@radix-ui/react-switch'
import { CaretDown, CaretRight } from '../components/ui/icons'
import { Card } from '../components/ui/Card'
import { RiskBadge } from '../components/ui/RiskBadge'
import { RISK_LEVEL, RISK_LEVELS_ORDERED } from '../lib/constants'
import type { RiskLevel } from '../lib/constants'

// Literal class names so Tailwind sees them.
const SWATCH: Record<RiskLevel, string> = {
  [RISK_LEVEL.LOW]: 'bg-risk-low',
  [RISK_LEVEL.MODERATE]: 'bg-risk-moderate',
  [RISK_LEVEL.HIGH]: 'bg-risk-high',
  [RISK_LEVEL.SEVERE]: 'bg-risk-severe',
  [RISK_LEVEL.NO_TRAVEL]: 'bg-risk-no-travel',
}
const NO_DATA_SWATCH = 'bg-risk-none'

type MapLegendProps = {
  showHeatmap: boolean
  /** Open by default on desktop, closed on a phone. */
  defaultOpen: boolean
  onShowHeatmapChange: (show: boolean) => void
  style?: CSSProperties
}

/** The risk legend, bottom-left of the map, with the switch that hides the heatmap (design 8.5). */
export function MapLegend({
  showHeatmap,
  defaultOpen,
  onShowHeatmapChange,
  style,
}: MapLegendProps) {
  const [open, setOpen] = useState(defaultOpen)
  const bodyId = useId()
  const switchId = useId()
  const Caret = open ? CaretDown : CaretRight
  return (
    <Card className="absolute z-10 w-max max-w-[calc(100%-20px)] px-3 py-2" style={style}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((value) => !value)}
        className="text-text focus-visible:outline-accent flex w-full items-center justify-between gap-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Risk
        <Caret aria-hidden size={14} weight="bold" />
      </button>
      <div id={bodyId} hidden={!open} className="mt-2 flex flex-col gap-1.5">
        {RISK_LEVELS_ORDERED.map((level) => (
          <div key={level} className="flex items-center gap-2">
            <span aria-hidden className={`size-3.5 shrink-0 rounded-sm ${SWATCH[level]}`} />
            <RiskBadge level={level} />
          </div>
        ))}
        <div className="flex items-center gap-2">
          <span aria-hidden className={`size-3.5 shrink-0 rounded-sm ${NO_DATA_SWATCH}`} />
          <RiskBadge level={null} />
        </div>
        <div className="border-border mt-1 flex items-center justify-between gap-3 border-t pt-2">
          <label htmlFor={switchId} className="text-text text-sm font-bold">
            Show heatmap
          </label>
          <Switch.Root
            id={switchId}
            checked={showHeatmap}
            onCheckedChange={onShowHeatmapChange}
            className="bg-border-strong data-[state=checked]:bg-accent focus-visible:outline-accent relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <Switch.Thumb className="bg-bg block size-5 translate-x-0.5 rounded-full transition-transform data-[state=checked]:translate-x-[22px]" />
          </Switch.Root>
        </div>
      </div>
    </Card>
  )
}
