import { useCallback, useSyncExternalStore } from 'react'
import { STORAGE_KEY, UNIT_SYSTEM } from '../lib/constants'
import type { UnitSystem } from '../lib/constants'
import { readUnits, writeStored } from '../lib/storage'

// The server render and hydration use imperial; the stored choice appears right after hydration
// (useSyncExternalStore), so prerendered markup never mismatches (architecture 12.2).
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getServerSnapshot(): UnitSystem {
  return UNIT_SYSTEM.IMPERIAL
}

/** Units choice: imperial by default, remembered under `tp-units` (design 8.7). */
export function useUnits() {
  const units = useSyncExternalStore(subscribe, readUnits, getServerSnapshot)

  const setUnits = useCallback((next: UnitSystem) => {
    writeStored(STORAGE_KEY.UNITS, next)
    listeners.forEach((listener) => listener())
  }, [])

  return { units, setUnits }
}
