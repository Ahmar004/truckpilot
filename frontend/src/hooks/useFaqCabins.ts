import { useCallback, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

/**
 * State for the FAQ wheel: one open cabin at a time, and arrow keys, Home and End move focus
 * between the cabin buttons. Returns props for each button.
 */
export function useFaqCabins(count: number) {
  const [open, setOpen] = useState<number | null>(null)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  const toggle = useCallback((i: number) => setOpen((cur) => (cur === i ? null : i)), [])

  const onKeyDown = useCallback(
    (e: KeyboardEvent, i: number) => {
      const next =
        e.key === 'ArrowDown' || e.key === 'ArrowRight'
          ? (i + 1) % count
          : e.key === 'ArrowUp' || e.key === 'ArrowLeft'
            ? (i - 1 + count) % count
            : e.key === 'Home'
              ? 0
              : e.key === 'End'
                ? count - 1
                : null
      if (next === null) return
      e.preventDefault()
      buttons.current[next]?.focus()
    },
    [count],
  )

  const register = useCallback((i: number, el: HTMLButtonElement | null) => {
    buttons.current[i] = el
  }, [])

  return { open, toggle, onKeyDown, register }
}
