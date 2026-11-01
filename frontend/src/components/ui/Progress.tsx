import { cn } from '../../lib/cn'

type ProgressProps = {
  value: number
  max: number
  /** Spoken value, for example "Step 3 of 8". */
  valueText?: string
  label: string
  className?: string
}

/** Progress pill with a "3/8" count next to it (UIi 6.17). */
export function Progress({ value, max, valueText, label, className }: ProgressProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuenow={value}
        aria-valuemax={max}
        aria-valuetext={valueText ?? `${value} of ${max}`}
        className="bg-border/60 h-2 w-24 overflow-hidden rounded-full"
      >
        <div
          className="animate-grow-x from-accent to-highlight h-full origin-left rounded-full bg-gradient-to-r transition-[width] duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-text-muted text-xs font-bold tabular-nums">
        {value}/{max}
      </span>
    </div>
  )
}
