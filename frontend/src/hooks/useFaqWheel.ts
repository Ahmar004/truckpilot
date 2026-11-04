import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import {
  angleAround,
  coastStep,
  DRAG_START_PX,
  easeInOut,
  FLICK_WINDOW_MS,
  KEY_TURN_MS,
  MAX_FRAME_MS,
  shortestDelta,
  SPIN_MAX_SPEED,
  SPIN_STOP_SPEED,
} from '../lib/scenes'

/** The pinned ride runs on wide, tall windows only (matches Landing.css). */
const RIDE_QUERY =
  '(prefers-reduced-motion: no-preference) and (min-width: 72rem) and (min-height: 36rem)'
/** The wheel is on its stand from 34% of the ride (faq-roll-in). */
const MOUNTED_AT = 0.36

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

type Sample = { t: number; angle: number }

/**
 * The FAQ Ferris wheel (UIi 9.6): one open cabin at a time; a cabin can be grabbed and flicked to
 * spin the wheel (it coasts with exponential decay); Left and Right turn it by one cabin and move
 * focus; Home and End jump. The user's turn is written to `--wheel-user` a frame at a time, with
 * no React render. Under reduced motion the wheel follows the pointer but never coasts.
 */
export function useFaqWheel(count: number) {
  const [open, setOpen] = useState<number | null>(null)
  const wheel = useRef<HTMLDivElement>(null)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const angle = useRef(0)
  const frame = useRef(0)
  const drag = useRef<{
    id: number
    x: number
    y: number
    cx: number
    cy: number
    last: number
    moving: boolean
    samples: Sample[]
  } | null>(null)
  const swallowClick = useRef(false)

  const write = useCallback(() => {
    wheel.current?.style.setProperty('--wheel-user', `${angle.current}deg`)
  }, [])

  const stop = useCallback(() => cancelAnimationFrame(frame.current), [])
  useEffect(() => stop, [stop])

  const toggle = useCallback((i: number) => {
    if (swallowClick.current) {
      swallowClick.current = false
      return
    }
    setOpen((cur) => (cur === i ? null : i))
  }, [])

  /** Turn by `delta` degrees with an ease-in-out, or at once under reduced motion. */
  const turnBy = useCallback(
    (delta: number) => {
      stop()
      if (reducedMotion()) {
        angle.current += delta
        write()
        return
      }
      const from = angle.current
      const start = performance.now()
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / KEY_TURN_MS)
        angle.current = from + delta * easeInOut(t)
        write()
        if (t < 1) frame.current = requestAnimationFrame(tick)
      }
      frame.current = requestAnimationFrame(tick)
    },
    [stop, write],
  )

  const onKeyDown = useCallback(
    (e: KeyboardEvent, i: number) => {
      const step = 360 / count
      let next: number | null = null
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % count
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + count) % count
      else if (e.key === 'Home') next = 0
      else if (e.key === 'End') next = count - 1
      if (next === null) return
      e.preventDefault()
      // Bring the next cabin to where this one hangs: the wheel turns the other way.
      turnBy(-shortestDelta(i * step, next * step))
      buttons.current[next]?.focus({ preventScroll: true })
    },
    [count, turnBy],
  )

  /** Focus that reaches a cabin before the wheel is on its stand scrolls to just past mounting. */
  const onFocus = useCallback(() => {
    const el = wheel.current?.closest<HTMLElement>('.faq-ride')
    if (!el || !window.matchMedia(RIDE_QUERY).matches) return
    const top = el.getBoundingClientRect().top + window.scrollY
    const travel = el.offsetHeight - window.innerHeight
    if (travel <= 0) return
    const progress = (window.scrollY - top) / travel
    if (progress < MOUNTED_AT) window.scrollTo({ top: top + travel * MOUNTED_AT })
  }, [])

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      stop()
      const box = e.currentTarget.getBoundingClientRect()
      const cx = box.left + box.width / 2
      const cy = box.top + box.height / 2
      const a = angleAround(cx, cy, e.clientX, e.clientY)
      drag.current = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        cx,
        cy,
        last: a,
        moving: false,
        samples: [{ t: e.timeStamp, angle: angle.current }],
      }
    },
    [stop],
  )

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const d = drag.current
      if (!d || d.id !== e.pointerId) return
      if (!d.moving) {
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < DRAG_START_PX) return
        d.moving = true
        // A release over a cabin is then not a click on it.
        e.currentTarget.setPointerCapture(e.pointerId)
      }
      const a = angleAround(d.cx, d.cy, e.clientX, e.clientY)
      angle.current += shortestDelta(d.last, a)
      d.last = a
      d.samples.push({ t: e.timeStamp, angle: angle.current })
      d.samples = d.samples.filter((s) => e.timeStamp - s.t <= FLICK_WINDOW_MS)
      write()
    },
    [write],
  )

  const onPointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const d = drag.current
      // Another finger lifting leaves this drag alone.
      if (!d || d.id !== e.pointerId) return
      drag.current = null
      if (!d.moving) return
      swallowClick.current = true
      // The click (if any) fires right after; clear the flag if none comes.
      setTimeout(() => (swallowClick.current = false), 0)
      if (reducedMotion()) return
      const recent = d.samples.filter((s) => e.timeStamp - s.t <= FLICK_WINDOW_MS)
      if (recent.length < 2) return
      const first = recent[0]
      const lastSample = recent[recent.length - 1]
      const dt = lastSample.t - first.t
      if (dt <= 0) return
      let speed = (lastSample.angle - first.angle) / dt
      speed = Math.max(-SPIN_MAX_SPEED, Math.min(SPIN_MAX_SPEED, speed))
      let prev = performance.now()
      const tick = (now: number) => {
        const step = coastStep(speed, Math.min(now - prev, MAX_FRAME_MS))
        prev = now
        angle.current += step.delta
        speed = step.speed
        write()
        if (Math.abs(speed) > SPIN_STOP_SPEED) frame.current = requestAnimationFrame(tick)
      }
      frame.current = requestAnimationFrame(tick)
    },
    [write],
  )

  /** The browser took the pointer (for example to scroll): end the drag with no coast or click. */
  const onPointerCancel = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id === e.pointerId) drag.current = null
  }, [])

  const register = useCallback((i: number, el: HTMLButtonElement | null) => {
    buttons.current[i] = el
  }, [])

  return {
    open,
    toggle,
    onKeyDown,
    onFocus,
    register,
    wheelRef: wheel,
    wheelHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
  }
}
