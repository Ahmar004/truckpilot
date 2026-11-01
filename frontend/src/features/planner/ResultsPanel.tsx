import * as Tabs from '@radix-ui/react-tabs'
import { cn } from '../../lib/cn'
import { PLANNER_STATUS, PLANNER_TAB, RECOMMENDATION } from '../../lib/constants'
import type { IntervalChoice, PlannerStatus, PlannerTab, UnitSystem } from '../../lib/constants'
import type { Plan } from '../../lib/types'
import type { PlannerMessage } from './plannerReducer'
import { ResultsMessage } from './ResultsMessage'
import { RouteCardList } from './RouteCardList'
import { TripSettings } from './TripSettings'
import { TripSummary } from './TripSummary'

type ResultsPanelProps = {
  plan: Plan
  status: PlannerStatus
  message: PlannerMessage | null
  interval: IntervalChoice
  hos: boolean
  routeId: string | null
  tab: PlannerTab
  units: UnitSystem
  onEdit: () => void
  onIntervalChange: (interval: IntervalChoice) => void
  onHosChange: (hos: boolean) => void
  onSelectRoute: (routeId: string) => void
  onTabChange: (tab: PlannerTab) => void
}

const triggerClass =
  'text-text-muted data-[state=active]:text-text data-[state=active]:border-accent focus-visible:outline-accent h-10 flex-1 border-b-2 border-transparent text-sm font-bold focus-visible:outline-2 focus-visible:-outline-offset-2 disabled:opacity-50'

/** Panel content with results on screen: summary, message, settings and tabs (design 8.2 items 2-5). */
export function ResultsPanel({
  plan,
  status,
  message,
  interval,
  hos,
  routeId,
  tab,
  units,
  onEdit,
  onIntervalChange,
  onHosChange,
  onSelectRoute,
  onTabChange,
}: ResultsPanelProps) {
  const updating = status === PLANNER_STATUS.UPDATING
  const hasRecommended = plan.routes.some((r) => r.recommendation === RECOMMENDATION.RECOMMENDED)
  const announcement = hasRecommended
    ? `${plan.routes.length} ${plan.routes.length === 1 ? 'route' : 'routes'} found. 1st best is recommended.`
    : 'Do not travel now'

  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <TripSummary trip={plan.trip} units={units} onEdit={onEdit} />
      <ResultsMessage plan={plan} message={message} units={units} onEditTrip={onEdit} />
      <TripSettings
        interval={interval}
        hos={hos}
        info={plan.interval}
        units={units}
        busy={updating}
        onIntervalChange={onIntervalChange}
        onHosChange={onHosChange}
      />
      <Tabs.Root value={tab} onValueChange={(value) => onTabChange(value as PlannerTab)}>
        <Tabs.List aria-label="Results" className="border-border flex border-b">
          <Tabs.Trigger value={PLANNER_TAB.ROUTES} className={triggerClass}>
            Routes
          </Tabs.Trigger>
          <Tabs.Trigger value={PLANNER_TAB.CHECKPOINTS} disabled className={triggerClass}>
            Checkpoints
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content
          value={PLANNER_TAB.ROUTES}
          aria-busy={updating}
          className={cn('pt-3 transition-opacity', updating && 'opacity-60')}
        >
          <RouteCardList
            routes={plan.routes}
            routeId={routeId}
            units={units}
            onSelectRoute={onSelectRoute}
          />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}
