import { lazy, Suspense, useCallback } from 'react'
import { Skeleton } from '../../components/ui/Skeleton'
import { BottomSheet } from '../../features/planner/BottomSheet'
import { PlannerPanel } from '../../features/planner/PlannerPanel'
import { useBottomSheet } from '../../features/planner/useBottomSheet'
import { useCheckpointSelection } from '../../features/planner/useCheckpointSelection'
import { usePlacePick } from '../../features/planner/usePlacePick'
import type { PickField } from '../../features/planner/usePlacePick'
import { usePlanner } from '../../features/planner/usePlanner'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useTheme } from '../../hooks/useTheme'
import { useUnits } from '../../hooks/useUnits'
import { DESKTOP_QUERY, TRIP_FIELD } from '../../lib/constants'
import type { Place } from '../../lib/types'

// MapLibre is large: it loads in its own chunk, only for the planner (architecture 12.4).
const PlannerMap = lazy(() => import('../../map/PlannerMap'))

/** The planner (design 8.1): the map fills the window; the panel or sheet floats over it. */
export default function Planner() {
  const planner = usePlanner()
  const { units } = useUnits()
  const { theme } = useTheme()
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const sheet = useBottomSheet()
  const { closeCheckpoint, openFromMap, selectFromPanel } = useCheckpointSelection(
    planner.state.selection.checkpointN,
    planner.actions.selectCheckpoint,
  )

  // "Choose on map" (Step-14b): the sheet steps down so the map can be tapped, and comes back.
  const { setOrigin, setDestination } = planner.actions
  const { lower, restore } = sheet
  const onPicked = useCallback(
    (field: PickField, place: Place) => {
      if (field === TRIP_FIELD.ORIGIN) setOrigin(place)
      else setDestination(place)
      restore()
    },
    [setOrigin, setDestination, restore],
  )
  const pick = usePlacePick(onPicked)
  const chooseOnMap = (field: PickField) => {
    if (pick.field === field) {
      pick.cancel()
      restore()
      return
    }
    if (!isDesktop) lower()
    pick.start(field)
  }
  const cancelPick = () => {
    pick.cancel()
    restore()
  }
  const picking = pick.field !== null
  // While picking, a click on the map sets the place and selects or closes nothing.
  const ignore = () => {}

  // Space the panel or sheet covers, so the controls and the fit stay clear of it.
  const padding = isDesktop
    ? { top: sheet.topPx, bottom: 0, right: 0, left: sheet.panelOpen ? sheet.panelWidthPx : 0 }
    : { top: sheet.topPx, bottom: sheet.sheetPx, right: 0, left: 0 }

  return (
    <>
      <div className="fixed inset-0 z-0">
        <Suspense fallback={<Skeleton className="size-full rounded-none" />}>
          <PlannerMap
            plan={planner.state.plan}
            routeId={planner.state.selection.routeId}
            checkpointN={planner.state.selection.checkpointN}
            hour={planner.state.view.hour}
            showHeatmap={planner.state.view.showHeatmap}
            theme={theme}
            units={units}
            isDesktop={isDesktop}
            padding={padding}
            onHourChange={planner.actions.setHour}
            onShowHeatmapChange={planner.actions.setShowHeatmap}
            onSelectRoute={picking ? ignore : planner.actions.selectRoute}
            onSelectCheckpoint={picking ? ignore : openFromMap}
            onCloseCheckpoint={picking ? ignore : closeCheckpoint}
            pick={
              pick.field && {
                fieldLabel: pick.field === TRIP_FIELD.ORIGIN ? 'Origin' : 'Destination',
                status: pick.status,
                retryAfterMin: pick.retryAfterMin,
              }
            }
            onPickPoint={pick.pickAt}
            onCancelPick={cancelPick}
          />
        </Suspense>
      </div>
      <BottomSheet
        height={sheet.height}
        sheetPx={sheet.sheetPx}
        dragging={sheet.dragging}
        handleProps={sheet.handleProps}
        panelOpen={sheet.panelOpen}
        isDesktop={isDesktop}
        onTogglePanel={sheet.togglePanel}
      >
        <PlannerPanel
          state={planner.state}
          actions={{ ...planner.actions, selectCheckpoint: selectFromPanel }}
          units={units}
          isDesktop={isDesktop}
          pickingField={pick.field}
          onChooseOnMap={chooseOnMap}
        />
      </BottomSheet>
    </>
  )
}
