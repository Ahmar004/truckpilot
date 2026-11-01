import { forwardRef } from 'react'
import { RiskBadge } from '../../components/ui/RiskBadge'
import { cn } from '../../lib/cn'
import { CHECKPOINT_ROW_ATTR, RISK_LEVEL } from '../../lib/constants'
import type { UnitSystem } from '../../lib/constants'
import { joinCauses } from '../../lib/checkpointText'
import { formatTime } from '../../lib/time'
import type { Checkpoint } from '../../lib/types'
import { formatMileOf } from '../../lib/units'

type CheckpointRowProps = {
  checkpoint: Checkpoint
  selected: boolean
  units: UnitSystem
  onSelect: () => void
}

/** One Checkpoint as a button (design 8.4). Low shows the badge only; no data shows its own badge. */
export const CheckpointRow = forwardRef<HTMLButtonElement, CheckpointRowProps>(
  function CheckpointRow({ checkpoint, selected, units, onSelect }, ref) {
    const { n, level, causes } = checkpoint
    const showCauses = level !== null && level !== RISK_LEVEL.LOW && causes.length > 0
    const rowAttr = { [CHECKPOINT_ROW_ATTR]: n }
    return (
      <button
        ref={ref}
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        {...rowAttr}
        className={cn(
          'border-border focus-visible:outline-accent flex w-full cursor-pointer flex-col gap-1 rounded-lg border px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2',
          selected ? 'bg-surface-hover border-accent' : 'bg-surface hover:bg-surface-hover',
        )}
      >
        <span className="text-text text-sm font-bold">
          Checkpoint {n} · {formatMileOf(checkpoint.mile, checkpoint.of_mi, units)}
        </span>
        <span className="text-text-muted text-sm">
          {formatTime(checkpoint.eta_utc, checkpoint.tz)}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <RiskBadge level={level} />
          {showCauses && (
            <span className="text-text-muted text-sm">set by {joinCauses(causes)}</span>
          )}
        </span>
      </button>
    )
  },
)
