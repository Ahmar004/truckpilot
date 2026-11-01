import { useCallback, useEffect, useRef } from 'react'
import { CHECKPOINT_ROW_ATTR, CHECKPOINT_SOURCE } from '../../lib/constants'
import type { CheckpointSource } from '../../lib/constants'

const MAP_CANVAS = '.maplibregl-canvas'

/**
 * Opening and closing a Checkpoint (design 8.4). Remembers where it was opened from: Esc, the
 * pop-up's close button and "Back to checkpoints" all close it, and focus returns to its row when
 * a row opened it, or to the map when a map marker did.
 */
export function useCheckpointSelection(
  checkpointN: number | null,
  selectCheckpoint: (n: number | null) => void,
) {
  const source = useRef<CheckpointSource>(CHECKPOINT_SOURCE.ROW)
  const returnTo = useRef<{ source: CheckpointSource; n: number } | null>(null)

  const closeCheckpoint = useCallback(() => {
    if (checkpointN === null) return
    returnTo.current = { source: source.current, n: checkpointN }
    selectCheckpoint(null)
  }, [checkpointN, selectCheckpoint])

  const openFromMap = useCallback(
    (n: number) => {
      source.current = CHECKPOINT_SOURCE.MAP
      selectCheckpoint(n)
    },
    [selectCheckpoint],
  )

  /** The Checkpoints tab: a row opens one, "Back to checkpoints" passes null. */
  const selectFromPanel = useCallback(
    (n: number | null) => {
      if (n === null) {
        closeCheckpoint()
        return
      }
      source.current = CHECKPOINT_SOURCE.ROW
      selectCheckpoint(n)
    },
    [closeCheckpoint, selectCheckpoint],
  )

  useEffect(() => {
    if (checkpointN === null) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      closeCheckpoint()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [checkpointN, closeCheckpoint])

  useEffect(() => {
    const target = returnTo.current
    if (checkpointN !== null || !target) return
    returnTo.current = null
    const element =
      target.source === CHECKPOINT_SOURCE.ROW
        ? document.querySelector<HTMLElement>(`[${CHECKPOINT_ROW_ATTR}="${target.n}"]`)
        : document.querySelector<HTMLElement>(MAP_CANVAS)
    element?.focus()
  }, [checkpointN])

  return { closeCheckpoint, openFromMap, selectFromPanel }
}
