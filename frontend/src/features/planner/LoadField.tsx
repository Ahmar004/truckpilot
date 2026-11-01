import { useId } from 'react'
import { cn } from '../../lib/cn'
import type { UnitSystem } from '../../lib/constants'
import type { FormLoad } from '../../lib/tripValidation'
import { displayLoad, loadUnitFor, MAX_LOAD } from '../../lib/units'

type LoadFieldProps = {
  /** The load as typed (number and unit). */
  load: FormLoad
  units: UnitSystem
  onChange: (load: FormLoad) => void
  error?: string
  disabled?: boolean
}

/**
 * Whole-number load with a unit suffix (design 4.2). The typed value and unit are kept: the units
 * toggle only changes the shown number, and editing makes the shown unit the typed one.
 */
export function LoadField({ load, units, onChange, error, disabled }: LoadFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  const unit = loadUnitFor(units)
  const shown =
    load.value === null ? '' : displayLoad({ value: load.value, unit: load.unit }, units).value

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-text text-sm font-bold">
        Load weight
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_LOAD[unit]}
          step={1}
          value={shown}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            const raw = event.target.value
            onChange({ value: raw === '' ? null : Number(raw), unit })
          }}
          className={cn(
            'border-border bg-surface text-text placeholder:text-text-faint focus-visible:outline-accent h-9 w-full rounded border pr-10 pl-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 disabled:opacity-50',
            error && 'border-danger',
          )}
        />
        <span
          aria-hidden
          className="text-text-muted pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm"
        >
          {unit}
        </span>
      </div>
      {error && (
        <p id={errorId} className="text-danger text-xs">
          {error}
        </p>
      )}
    </div>
  )
}
