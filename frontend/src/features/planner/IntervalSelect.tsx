import * as Select from '@radix-ui/react-select'
import { CaretDown, Check } from '../../components/ui/icons'
import { INTERVAL_AUTO, INTERVAL_MILES } from '../../lib/constants'
import type { IntervalChoice, UnitSystem } from '../../lib/constants'
import { formatInterval } from '../../lib/units'

type IntervalSelectProps = {
  value: IntervalChoice
  onChange: (value: IntervalChoice) => void
  units: UnitSystem
  /** What the Auto item reads. "Auto" before a plan; "Auto (25 mi)" once the length is known. */
  autoLabel?: string
  disabled?: boolean
  label?: string
}

const toChoice = (raw: string): IntervalChoice =>
  raw === INTERVAL_AUTO ? INTERVAL_AUTO : (Number(raw) as IntervalChoice)

/** Interval choices Auto, 10, 25, 50 mi; metric shows whole km, the value stays miles (design 8.7). */
export function IntervalSelect({
  value,
  onChange,
  units,
  autoLabel = 'Auto',
  disabled,
  label = 'Interval',
}: IntervalSelectProps) {
  const labelFor = (choice: IntervalChoice) =>
    choice === INTERVAL_AUTO ? autoLabel : formatInterval(choice, units)
  const itemClass =
    'text-text data-[highlighted]:bg-surface-hover flex cursor-pointer items-center justify-between gap-2 rounded px-3 py-2 text-sm outline-none'

  return (
    <Select.Root
      value={String(value)}
      onValueChange={(raw) => onChange(toChoice(raw))}
      disabled={disabled}
    >
      <Select.Trigger
        aria-label={label}
        className="border-border bg-surface text-text focus-visible:outline-accent flex h-9 w-full items-center justify-between rounded border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 disabled:opacity-50"
      >
        <Select.Value>{labelFor(value)}</Select.Value>
        <Select.Icon>
          <CaretDown aria-hidden size={16} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={4}
          className="border-border bg-surface shadow-card-hover z-50 min-w-(--radix-select-trigger-width) rounded-lg border p-1"
        >
          <Select.Viewport>
            {([INTERVAL_AUTO, ...INTERVAL_MILES] as IntervalChoice[]).map((choice) => (
              <Select.Item key={choice} value={String(choice)} className={itemClass}>
                <Select.ItemText>{labelFor(choice)}</Select.ItemText>
                <Select.ItemIndicator>
                  <Check aria-hidden size={16} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}
