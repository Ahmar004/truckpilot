// Safe access to the only two things the app stores in the browser (design 3.5).
// Storage can be blocked or missing; every access is wrapped and falls back quietly.
import { STORAGE_KEY, THEME, UNIT_SYSTEM } from './constants'
import type { Theme, UnitSystem } from './constants'

type StorageKey = (typeof STORAGE_KEY)[keyof typeof STORAGE_KEY]

export function readStored(key: StorageKey): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStored(key: StorageKey, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // blocked storage just means the choice is not remembered
  }
}

export function readTheme(): Theme {
  return readStored(STORAGE_KEY.THEME) === THEME.DARK ? THEME.DARK : THEME.LIGHT
}

export function readUnits(): UnitSystem {
  return readStored(STORAGE_KEY.UNITS) === UNIT_SYSTEM.METRIC
    ? UNIT_SYSTEM.METRIC
    : UNIT_SYSTEM.IMPERIAL
}
