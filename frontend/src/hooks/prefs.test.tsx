import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { STORAGE_KEY, THEME, UNIT_SYSTEM } from '../lib/constants'
import { readTheme, readUnits } from '../lib/storage'
import { useTheme } from './useTheme'
import { useUnits } from './useUnits'

afterEach(() => {
  window.localStorage.clear()
  document.documentElement.classList.remove('dark')
})

describe('storage reads', () => {
  it('fall back to the defaults', () => {
    expect(readUnits()).toBe(UNIT_SYSTEM.IMPERIAL)
    expect(readTheme()).toBe(THEME.LIGHT)
    window.localStorage.setItem(STORAGE_KEY.UNITS, 'junk')
    expect(readUnits()).toBe(UNIT_SYSTEM.IMPERIAL)
  })
})

describe('useUnits', () => {
  it('remembers the choice and tells every user of the hook', () => {
    const a = renderHook(() => useUnits())
    const b = renderHook(() => useUnits())
    expect(a.result.current.units).toBe(UNIT_SYSTEM.IMPERIAL)
    act(() => a.result.current.setUnits(UNIT_SYSTEM.METRIC))
    expect(a.result.current.units).toBe(UNIT_SYSTEM.METRIC)
    expect(b.result.current.units).toBe(UNIT_SYSTEM.METRIC)
    expect(window.localStorage.getItem(STORAGE_KEY.UNITS)).toBe(UNIT_SYSTEM.METRIC)
  })
})

describe('useTheme', () => {
  it('toggles the dark class and stores the choice', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe(THEME.LIGHT)
    act(() => result.current.toggleTheme())
    expect(result.current.theme).toBe(THEME.DARK)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(window.localStorage.getItem(STORAGE_KEY.THEME)).toBe(THEME.DARK)
    act(() => result.current.toggleTheme())
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
