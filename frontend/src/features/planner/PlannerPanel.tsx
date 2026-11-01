import type { KeyboardEvent } from 'react'
import { Truck } from '../../components/ui/icons'
import { PLANNER_STATUS } from '../../lib/constants'
import type { UnitSystem } from '../../lib/constants'
import { PlannerBanner } from './PlannerBanner'
import { PlanningState } from './PlanningState'
import { ResultsPanel } from './ResultsPanel'
import { TripForm } from './TripForm'
import type { usePlanner } from './usePlanner'

type PlannerPanelProps = ReturnType<typeof usePlanner> & { units: UnitSystem }

/**
 * Panel content (design 8.2): the trip form, or the results (summary, settings, tabs) once a plan
 * exists. "Edit" opens the filled form over the results; Esc closes it back to the summary.
 */
export function PlannerPanel({ state, actions, units }: PlannerPanelProps) {
  const { form, errors, status, message, plan, view, selection } = state
  const planning = status === PLANNER_STATUS.PLANNING
  const showResults =
    plan !== null &&
    !view.editing &&
    (status === PLANNER_STATUS.RESULTS || status === PLANNER_STATUS.UPDATING)

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return
    if (planning) actions.cancel()
    else if (view.editing) actions.closeEdit()
  }

  return (
    <div onKeyDown={onKeyDown} className="flex flex-col gap-4">
      <PlannerBanner
        status={status}
        message={message}
        onRetry={() => void actions.submit()}
        onEditTrip={actions.editTrip}
      />
      {showResults && (
        <ResultsPanel
          plan={plan}
          status={status}
          message={message}
          interval={form.interval}
          hos={form.hos}
          routeId={selection.routeId}
          tab={view.tab}
          units={units}
          onEdit={actions.editTrip}
          onIntervalChange={actions.updateInterval}
          onHosChange={actions.updateHos}
          onSelectRoute={actions.selectRoute}
          onTabChange={actions.setTab}
        />
      )}
      {!showResults && (
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
      )}
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
