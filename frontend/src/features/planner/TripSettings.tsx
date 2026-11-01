import * as Switch from '@radix-ui/react-switch'
import { useId } from 'react'
import { INTERVAL_AUTO } from '../../lib/constants'
import type { IntervalChoice, UnitSystem } from '../../lib/constants'
import type { IntervalInfo } from '../../lib/types'
import { formatInterval } from '../../lib/units'
import { IntervalSelect } from './IntervalSelect'

type TripSettingsProps = {
  interval: IntervalChoice
  hos: boolean
  info: IntervalInfo
  units: UnitSystem
  /** An update is in progress: the controls are dimmed and disabled. */
  busy: boolean
  onIntervalChange: (interval: IntervalChoice) => void
  onHosChange: (hos: boolean) => void
}

/** Interval select and HOS switch for the current plan; a change is an Update (design 8.2 item 4). */
export function TripSettings({
  interval,
  hos,
  info,
  units,
  busy,
  onIntervalChange,
  onHosChange,
}: TripSettingsProps) {
  const hosId = useId()
  const autoLabel =
    interval === INTERVAL_AUTO ? `Auto (${formatInterval(info.used_mi, units)})` : 'Auto'
  return (
    <div
      aria-busy={busy}
      className={`flex flex-col gap-2 transition-opacity ${busy ? 'opacity-60' : ''}`}
    >
      {busy && (
        <div
          role="progressbar"
          aria-label="Updating the plan"
          className="bg-border/60 h-1 w-full overflow-hidden rounded-full"
        >
          <div className="animate-shimmer h-full w-full bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--border)_0%,var(--accent)_50%,var(--border)_100%)]" />
        </div>
      )}
      <div className="flex items-end justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-text text-sm font-bold">Interval</span>
          <IntervalSelect
            value={interval}
            onChange={onIntervalChange}
            units={units}
            autoLabel={autoLabel}
            options={info.options}
            disabled={busy}
          />
        </div>
        <div className="flex h-9 items-center gap-2">
          <label htmlFor={hosId} className="text-text text-sm font-bold">
            HOS breaks
          </label>
          <Switch.Root
            id={hosId}
            checked={hos}
            disabled={busy}
            onCheckedChange={onHosChange}
            className="bg-border-strong data-[state=checked]:bg-accent focus-visible:outline-accent relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
          >
            <Switch.Thumb className="bg-bg block size-5 translate-x-0.5 rounded-full transition-transform data-[state=checked]:translate-x-[22px]" />
          </Switch.Root>
        </div>
      </div>
    </div>
  )
}
