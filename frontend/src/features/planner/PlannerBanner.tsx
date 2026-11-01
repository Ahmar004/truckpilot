import { Button } from '../../components/ui/Button'
import { StatusMessage } from '../../components/ui/StatusMessage'
import { ERROR_CODE, PLANNER_STATUS, PROVIDER_SERVICE_NAME } from '../../lib/constants'
import type { PlannerStatus } from '../../lib/constants'
import { budgetLimitText, planLimitText, searchLimitText } from '../../lib/limitText'
import type { PlannerMessage } from './plannerReducer'

type PlannerBannerProps = {
  status: PlannerStatus
  message: PlannerMessage | null
  onRetry: () => void
  onEditTrip: () => void
}

function limitMessage({ code, service, retryAfterMin }: PlannerMessage): string {
  const minutes = retryAfterMin ?? 1
  if (code === ERROR_CODE.SEARCH_LIMITED) return searchLimitText(minutes)
  if (code === ERROR_CODE.PROVIDER_BUDGET && service) return budgetLimitText(service)
  return planLimitText(minutes)
}

/** The one message above the form for Error, No route and Limit reached (design 8.6). */
export function PlannerBanner({ status, message, onRetry, onEditTrip }: PlannerBannerProps) {
  if (status === PLANNER_STATUS.NO_ROUTE) {
    return (
      <div className="flex flex-col items-center gap-2">
        <StatusMessage>No truck route found between these places.</StatusMessage>
        <Button variant="secondary" size="sm" onClick={onEditTrip}>
          Edit trip
        </Button>
      </div>
    )
  }
  if (status === PLANNER_STATUS.LIMITED && message) {
    return <StatusMessage tone="warning">{limitMessage(message)}</StatusMessage>
  }
  if (status === PLANNER_STATUS.ERROR) {
    const name = message?.service ? PROVIDER_SERVICE_NAME[message.service] : 'Service'
    return (
      <div className="flex flex-col items-center gap-2">
        <StatusMessage>{name} unavailable.</StatusMessage>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </div>
    )
  }
  return null
}
