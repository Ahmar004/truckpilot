import type { KeyboardEvent } from 'react'
import { Truck } from '../../components/ui/icons'
import { PLANNER_STATUS } from '../../lib/constants'
import type { UnitSystem } from '../../lib/constants'
import { PlannerBanner } from './PlannerBanner'
import { PlanningState } from './PlanningState'
import { TripForm } from './TripForm'
import type { usePlanner } from './usePlanner'

type PlannerPanelProps = ReturnType<typeof usePlanner> & { units: UnitSystem }

/**
 * Panel content for slice 11: the Empty, Planning, Error, No route and Limit reached states.
 * Results rendering (summary, tabs, route cards) arrives in slice 12; until then a finished plan
 * shows the filled form again.
 */
export function PlannerPanel({ state, actions, units }: PlannerPanelProps) {
  const { form, errors, status, message } = state
  const planning = status === PLANNER_STATUS.PLANNING

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && planning) actions.cancel()
  }

  return (
    <div onKeyDown={onKeyDown} className="flex flex-col gap-4">
      <PlannerBanner
        status={status}
        message={message}
        onRetry={() => void actions.submit()}
        onEditTrip={actions.editTrip}
      />
      <TripForm
        form={form}
        errors={errors}
        units={units}
        planning={planning}
        onOriginChange={actions.setOrigin}
        onDestinationChange={actions.setDestination}
        onSwap={actions.swapPlaces}
        onDepartureChange={actions.setDeparture}
        onLoadChange={actions.setLoad}
        onIntervalChange={actions.setIntervalChoice}
        onHosChange={actions.setHos}
        onSubmit={() => void actions.submit()}
      />
      {planning && <PlanningState onCancel={actions.cancel} />}
      {status === PLANNER_STATUS.EMPTY && (
        <div className="text-text-muted flex flex-col items-center gap-3 py-4 text-center">
          <span className="bg-surface-hover text-accent grid size-14 place-items-center rounded-full">
            <Truck aria-hidden size={28} />
          </span>
          <p className="max-w-xs text-sm">
            Enter a trip to see up to 3 truck routes rated for weather risk.
          </p>
        </div>
      )}
    </div>
  )
}
