import { Input } from '../../components/ui/Input'
import { nowInZone, zoneAbbreviation } from '../../lib/time'

type DepartureFieldProps = {
  /** Wall time in the origin's zone, "YYYY-MM-DDTHH:mm" */
  value: string
  onChange: (value: string) => void
  /** The origin's IANA zone; null until an origin is picked. */
  timeZone: string | null
  error?: string
  disabled?: boolean
}

/** Native datetime-local with the origin's zone under it (design 4.2). Off until an origin is picked. */
export function DepartureField({
  value,
  onChange,
  timeZone,
  error,
  disabled,
}: DepartureFieldProps) {
  // The zone name depends on the date (CST or CDT), so read it at the chosen time.
  const at = value ? new Date(`${value}:00Z`) : new Date()
  const zoneNote = timeZone
    ? `Origin time (${zoneAbbreviation(Number.isNaN(at.getTime()) ? new Date().toISOString() : at.toISOString(), timeZone)})`
    : 'Pick an origin first.'
  return (
    <div className="flex flex-col gap-1.5">
      <Input
        label="Departure"
        type="datetime-local"
        value={timeZone ? value : ''}
        min={timeZone ? nowInZone(timeZone) : undefined}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || !timeZone}
        error={error}
      />
      <p className="text-text-muted text-xs">{zoneNote}</p>
    </div>
  )
}
