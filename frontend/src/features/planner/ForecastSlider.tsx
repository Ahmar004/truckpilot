import * as Slider from '@radix-ui/react-slider'
import type { CSSProperties, KeyboardEvent } from 'react'
import { Card } from '../../components/ui/Card'
import { cn } from '../../lib/cn'
import { SLIDER_MAX_HOUR, SLIDER_TICKS } from '../../lib/constants'

type ForecastSliderProps = {
  hour: number
  /** "+12 h · Wed, Nov 4 · 1:00 AM CST" */
  valueText: string
  ariaValueText: string
  onHourChange: (hour: number) => void
  onKeyDownCapture: (event: KeyboardEvent) => void
  /** Keeps the card clear of the panel, the sheet and the map controls. */
  style?: CSSProperties
}

const LABEL_ID = 'forecast-hour-label'

/** The Forecast hour slider, a floating card at the bottom centre of the map (design 8.5). */
export function ForecastSlider({
  hour,
  valueText,
  ariaValueText,
  onHourChange,
  onKeyDownCapture,
  style,
}: ForecastSliderProps) {
  return (
    <div className="pointer-events-none absolute z-10 flex justify-center" style={style}>
      <Card className="pointer-events-auto w-[min(36rem,100%)] px-4 pt-3 pb-2">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span id={LABEL_ID} className="text-text text-sm font-bold">
            Forecast hour
          </span>
          <span className="text-text-muted text-xs font-bold" aria-hidden>
            {valueText}
          </span>
        </div>
        <Slider.Root
          min={0}
          max={SLIDER_MAX_HOUR}
          step={1}
          value={[hour]}
          onValueChange={([next]) => onHourChange(next ?? 0)}
          onKeyDownCapture={onKeyDownCapture}
          className="relative flex h-6 w-full touch-none items-center select-none"
        >
          <Slider.Track className="bg-border-strong relative h-1.5 grow rounded-full">
            <Slider.Range className="bg-accent absolute h-full rounded-full" />
          </Slider.Track>
          <Slider.Thumb
            aria-labelledby={LABEL_ID}
            aria-valuetext={ariaValueText}
            className="border-accent bg-surface shadow-card focus-visible:outline-accent block size-5 rounded-full border-2 focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        </Slider.Root>
        <div className="relative mt-1 h-4" aria-hidden>
          {SLIDER_TICKS.map(({ hour: tick, phoneHidden }) => (
            <span
              key={tick}
              className={cn(
                'text-text-muted absolute -translate-x-1/2 text-[11px] font-bold',
                phoneHidden && 'max-sm:hidden',
              )}
              style={{ left: `${(tick / SLIDER_MAX_HOUR) * 100}%` }}
            >
              {tick}
            </span>
          ))}
        </div>
      </Card>
    </div>
  )
}
