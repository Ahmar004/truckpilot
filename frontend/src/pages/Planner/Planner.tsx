import { lazy, Suspense } from 'react'
import { Skeleton } from '../../components/ui/Skeleton'
import { BottomSheet } from '../../features/planner/BottomSheet'
import { PlannerPanel } from '../../features/planner/PlannerPanel'
import { useBottomSheet } from '../../features/planner/useBottomSheet'
import { useCheckpointSelection } from '../../features/planner/useCheckpointSelection'
import { usePlanner } from '../../features/planner/usePlanner'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useTheme } from '../../hooks/useTheme'
import { useUnits } from '../../hooks/useUnits'
import { DESKTOP_QUERY } from '../../lib/constants'

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
            onSelectRoute={planner.actions.selectRoute}
            onSelectCheckpoint={openFromMap}
            onCloseCheckpoint={closeCheckpoint}
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
        />
      </BottomSheet>
    </>
  )
}
