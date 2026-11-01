import { useEffect, useRef } from 'react'
import type { UnitSystem } from '../../lib/constants'
import { rankLabel } from '../../lib/routeLabel'
import type { Route } from '../../lib/types'
import { CheckpointRow } from './CheckpointRow'

type CheckpointListProps = {
  route: Route
  checkpointN: number | null
  units: UnitSystem
  onSelectCheckpoint: (n: number) => void
}

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Heading plus one row per Checkpoint of the selected route (design 8.4). */
export function CheckpointList({
  route,
  checkpointN,
  units,
  onSelectCheckpoint,
}: CheckpointListProps) {
  const selectedRow = useRef<HTMLButtonElement | null>(null)
  const count = route.checkpoints.length

  // A Checkpoint picked on the map scrolls its row into view; a row already visible stays put.
  useEffect(() => {
    selectedRow.current?.scrollIntoView({
      block: 'nearest',
      behavior: reducedMotion() ? 'auto' : 'smooth',
    })
  }, [checkpointN])

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-text text-sm font-bold">
        {rankLabel(route.rank)} · {count} {count === 1 ? 'checkpoint' : 'checkpoints'}
      </h2>
      <ul className="flex flex-col gap-2">
        {route.checkpoints.map((checkpoint) => (
          <li key={checkpoint.n}>
            <CheckpointRow
              ref={checkpoint.n === checkpointN ? selectedRow : undefined}
              checkpoint={checkpoint}
              selected={checkpoint.n === checkpointN}
              units={units}
              onSelect={() => onSelectCheckpoint(checkpoint.n)}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
