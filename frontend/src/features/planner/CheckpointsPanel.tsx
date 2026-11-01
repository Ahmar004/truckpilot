import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { CaretLeft } from '../../components/ui/icons'
import type { UnitSystem } from '../../lib/constants'
import type { Load, Route } from '../../lib/types'
import { CheckpointDetail } from './CheckpointDetail'
import { CheckpointList } from './CheckpointList'

type CheckpointsPanelProps = {
  route: Route
  checkpointN: number | null
  load: Load
  units: UnitSystem
  /** Desktop shows the detail in a map pop-up; a phone shows it here, in place of the list. */
  isDesktop: boolean
  onSelectCheckpoint: (n: number) => void
  onBack: () => void
}

/** The Checkpoints tab: the list, or on a phone the open Checkpoint's detail (design 8.4). */
export function CheckpointsPanel({
  route,
  checkpointN,
  load,
  units,
  isDesktop,
  onSelectCheckpoint,
  onBack,
}: CheckpointsPanelProps) {
  const open = route.checkpoints.find((c) => c.n === checkpointN)
  if (open && !isDesktop) {
    return (
      <div className="flex flex-col gap-3">
        <Button variant="ghost" size="sm" className="self-start" onClick={onBack}>
          <CaretLeft aria-hidden size={16} weight="bold" />
          Back to checkpoints
        </Button>
        <Card className="p-4">
          <CheckpointDetail checkpoint={open} load={load} units={units} />
        </Card>
      </div>
    )
  }
  return (
    <CheckpointList
      route={route}
      checkpointN={checkpointN}
      units={units}
      onSelectCheckpoint={onSelectCheckpoint}
    />
  )
}
