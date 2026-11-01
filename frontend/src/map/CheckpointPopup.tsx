import { Card } from '../components/ui/Card'
import { X } from '../components/ui/icons'
import type { UnitSystem } from '../lib/constants'
import type { Checkpoint, Load } from '../lib/types'
import { CheckpointDetail } from '../features/planner/CheckpointDetail'

type CheckpointPopupProps = {
  checkpoint: Checkpoint
  load: Load
  units: UnitSystem
  onClose: () => void
}

/** The content of a Checkpoint pop-up on desktop: the detail in a Card with a round close button. */
export function CheckpointPopup({ checkpoint, load, units, onClose }: CheckpointPopupProps) {
  return (
    <Card className="relative w-72 p-4 pr-12">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="text-text-muted hover:bg-surface-hover hover:text-text focus-visible:outline-accent absolute top-2 right-2 grid size-8 place-items-center rounded-full focus-visible:outline-2"
      >
        <X aria-hidden size={16} weight="bold" />
      </button>
      <CheckpointDetail checkpoint={checkpoint} load={load} units={units} />
    </Card>
  )
}
