import { forwardRef } from 'react'
import type { KeyboardEvent } from 'react'
import { Badge } from '../../components/ui/Badge'
import {
  CheckCircle,
  CloudSlash,
  Prohibit,
  Warning,
  WarningOctagon,
} from '../../components/ui/icons'
import { cn } from '../../lib/cn'
import { RECOMMENDATION } from '../../lib/constants'
import type { UnitSystem } from '../../lib/constants'
import { rankLabel } from '../../lib/routeLabel'
import { formatTime } from '../../lib/time'
import type { Route } from '../../lib/types'
import { formatDistance, formatDuration, formatRiskMiles } from '../../lib/units'

type RouteCardProps = {
  route: Route
  selected: boolean
  units: UnitSystem
  onSelect: () => void
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
}

/** One route as a radio in the route group (design 8.3). Pure: data in, callbacks out. */
export const RouteCard = forwardRef<HTMLDivElement, RouteCardProps>(function RouteCard(
  { route, selected, units, onSelect, onKeyDown },
  ref,
) {
  const { miles } = route
  const recommended = route.recommendation === RECOMMENDATION.RECOMMENDED
  const notRecommended = route.recommendation === RECOMMENDATION.NOT_RECOMMENDED
  const risks = [
    {
      key: 'severe',
      label: 'Severe',
      icon: WarningOctagon,
      color: 'text-risk-severe',
      mi: miles.severe,
    },
    { key: 'high', label: 'High', icon: Warning, color: 'text-risk-high', mi: miles.high },
    {
      key: 'no_travel',
      label: 'No Travel',
      icon: Prohibit,
      color: 'text-risk-no-travel',
      mi: miles.no_travel,
    },
  ]

  return (
    <div
      ref={ref}
      role="radio"
      aria-checked={selected}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={cn(
        'border-border focus-visible:outline-accent relative flex cursor-pointer flex-col gap-2 overflow-hidden rounded-lg border p-3 pl-4 text-left transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2',
        selected ? 'bg-surface-hover' : 'bg-surface hover:-translate-y-px hover:shadow-card-hover',
      )}
    >
      {selected && <span aria-hidden className="bg-route-selected absolute inset-y-0 left-0 w-1" />}
      <div className="flex items-center justify-between gap-2">
        <span className="text-text text-sm font-bold">{rankLabel(route.rank)}</span>
        {recommended && (
          <Badge className="bg-risk-low/15 text-risk-low">
            <CheckCircle aria-hidden size={14} weight="fill" />
            Recommended
          </Badge>
        )}
        {notRecommended && (
          <Badge className="bg-risk-no-travel/15 text-risk-no-travel">
            <Prohibit aria-hidden size={14} weight="bold" />
            Not recommended
          </Badge>
        )}
      </div>
      <p className="text-text text-lg font-bold">
        {formatDistance(route.distance_mi, units)}
        <span className="text-text-muted"> · </span>
        {formatDuration(route.travel_s / 60)}
      </p>
      <p className="text-text-muted text-sm">
        Arrives {formatTime(route.arrival_utc, route.arrival_tz)}
      </p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {risks.map(({ key, label, icon: Icon, color, mi }) => (
          <li key={key} className={cn('flex items-center gap-1 font-bold', color)}>
            <Icon aria-hidden size={16} weight="bold" />
            {label} {formatRiskMiles(mi, units)}
          </li>
        ))}
      </ul>
      <p className="text-text text-sm">
        Average risk{' '}
        <span className="font-bold">
          {route.average_risk === null ? 'None' : `${route.average_risk.toFixed(2)} of 4`}
        </span>
      </p>
      {miles.no_data > 0 && (
        <p className="text-text-muted flex items-start gap-1.5 text-sm">
          <CloudSlash aria-hidden size={16} className="mt-0.5 shrink-0" />
          {formatDistance(miles.no_data, units)} have no weather data yet (more than 10 days ahead
          from now)
        </p>
      )}
    </div>
  )
})
