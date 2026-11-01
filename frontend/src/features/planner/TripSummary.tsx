import { Button } from '../../components/ui/Button'
import type { UnitSystem } from '../../lib/constants'
import { formatTime } from '../../lib/time'
import type { Trip } from '../../lib/types'
import { displayLoad, formatLoad } from '../../lib/units'

type TripSummaryProps = { trip: Trip; units: UnitSystem; onEdit: () => void }

/** One line after a plan, with an Edit button (design 4.2). Time is in the origin's zone. */
export function TripSummary({ trip, units, onEdit }: TripSummaryProps) {
  const departs = formatTime(trip.departure_utc, trip.origin.tz)
  const load = formatLoad(displayLoad(trip.load, units))
  return (
    <div className="flex items-start justify-between gap-3">
      <p className="text-text min-w-0 text-sm font-bold">
        {trip.origin.label} to {trip.destination.label}
        <span className="text-text-muted font-normal">
          {' '}
          · {departs} · {load}
        </span>
      </p>
      <Button variant="outline" size="sm" onClick={onEdit} className="shrink-0">
        Edit
      </Button>
    </div>
  )
}
