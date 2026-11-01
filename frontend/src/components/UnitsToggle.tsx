import * as ToggleGroup from '@radix-ui/react-toggle-group'
import { UNIT_SYSTEM } from '../lib/constants'
import type { UnitSystem } from '../lib/constants'

type UnitsToggleProps = {
  value: UnitSystem
  onChange: (next: UnitSystem) => void
}

const OPTIONS = [
  { value: UNIT_SYSTEM.IMPERIAL, label: 'mi' },
  { value: UNIT_SYSTEM.METRIC, label: 'km' },
] as const

/** Two-option segmented control "mi" / "km". Display only: risk rules stay imperial. */
export function UnitsToggle({ value, onChange }: UnitsToggleProps) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      // Radix sends an empty string when the active item is pressed again; one option stays on.
      onValueChange={(next) => {
        if (next) onChange(next as UnitSystem)
      }}
      aria-label="Distance units"
      className="border-border bg-surface inline-flex rounded-full border p-0.5"
    >
      {OPTIONS.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          className="text-text-muted data-[state=on]:bg-accent data-[state=on]:text-accent-ink hover:text-text h-8 min-w-10 rounded-full px-3 text-sm font-bold transition-colors active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-accent data-[state=on]:hover:text-accent-ink"
        >
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
