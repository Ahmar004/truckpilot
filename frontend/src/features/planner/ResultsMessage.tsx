import { Button } from '../../components/ui/Button'
import { Info, Prohibit, Warning } from '../../components/ui/icons'
import { StatusMessage } from '../../components/ui/StatusMessage'
import { ERROR_CODE } from '../../lib/constants'
import type { UnitSystem } from '../../lib/constants'
import { TRIP_ERROR_TEXT } from '../../lib/tripValidation'
import type { Plan } from '../../lib/types'
import { formatInterval } from '../../lib/units'
import type { PlannerMessage } from './plannerReducer'

type ResultsMessageProps = {
  plan: Plan
  message: PlannerMessage | null
  units: UnitSystem
  onEditTrip: () => void
}

/** The one message above the settings, by priority: error, limit, Do not travel, fewer routes, interval note (design 8.2 item 3). */
export function ResultsMessage({ plan, message, units, onEditTrip }: ResultsMessageProps) {
  if (message?.code === ERROR_CODE.DEPARTURE_PASSED) {
    return (
      <StatusMessage
        tone="warning"
        icon={<Warning aria-hidden size={18} weight="bold" />}
        action={
          <Button variant="secondary" size="sm" onClick={onEditTrip}>
            Edit trip
          </Button>
        }
      >
        {TRIP_ERROR_TEXT.DEPARTURE_PASSED}
      </StatusMessage>
    )
  }
  if (plan.notices.do_not_travel) {
    return (
      <StatusMessage icon={<Prohibit aria-hidden size={18} weight="bold" />}>
        Do not travel now
        <span className="mt-1 block font-normal">
          Every route has No Travel miles at this departure time.
        </span>
      </StatusMessage>
    )
  }
  if (plan.notices.fewer_routes !== null) {
    return (
      <StatusMessage tone="info" role="status" icon={<Info aria-hidden size={18} weight="bold" />}>
        Only {plan.notices.fewer_routes} distinct truck routes exist between these places.
      </StatusMessage>
    )
  }
  const { requested_mi: requested, used_mi: used } = plan.interval
  if (requested !== null) {
    return (
      <StatusMessage tone="info" role="status" icon={<Info aria-hidden size={18} weight="bold" />}>
        {formatInterval(requested, units)} needs too many checkpoints for this trip. Using{' '}
        {formatInterval(used, units)}.
      </StatusMessage>
    )
  }
  return null
}
