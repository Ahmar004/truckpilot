import { useCallback, useSyncExternalStore } from 'react'
import { STORAGE_KEY, THEME } from '../lib/constants'
import type { Theme } from '../lib/constants'
import { writeStored } from '../lib/storage'

// The inline <head> script sets the `.dark` class before first paint (design 3.5), so the class on
// <html> is the source of truth. useSyncExternalStore keeps the server render and hydration on
// light, then moves to the real value without a mismatch.
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains('dark') ? THEME.DARK : THEME.LIGHT
}

function getServerSnapshot(): Theme {
  return THEME.LIGHT
}

/** Theme choice. Toggles the `.dark` class on <html>; light by default (design 3.5). */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setTheme = useCallback((next: Theme) => {
    document.documentElement.classList.toggle('dark', next === THEME.DARK)
    writeStored(STORAGE_KEY.THEME, next)
    listeners.forEach((listener) => listener())
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(getSnapshot() === THEME.DARK ? THEME.LIGHT : THEME.DARK)
  }, [setTheme])

  return { theme, setTheme, toggleTheme }
}
