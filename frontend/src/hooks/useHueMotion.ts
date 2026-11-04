import { useEffect } from 'react'
import type { RefObject } from 'react'
import type { Ball } from '../lib/hueMotion'
import { loadHueMotion } from './loadHueMotion'

const IDLE_TIMEOUT_MS = 2000

/**
 * Moves the hue balls as slow billiard balls (UIi 4.2) once the browser is idle. Does nothing
 * under reduced motion: the CSS start points are the finished layout.
 */
export function useHueMotion(root: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const element = root.current
    if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    let stopped = false
    const start = async () => {
      const { stepBalls, ballSpeed, clampToBounds } = await loadHueMotion()
      if (stopped) return
      const nodes = [...element.querySelectorAll<HTMLElement>('.hue-ball')]
      const bounds = () => ({ width: element.clientWidth, height: element.clientHeight })
      const balls: Ball[] = nodes.map((node) => {
        const r = node.offsetWidth / 2
        const angle = Math.random() * Math.PI * 2
        return {
          x: node.offsetLeft + r,
          y: node.offsetTop + r,
          vx: Math.cos(angle) * ballSpeed(r),
          vy: Math.sin(angle) * ballSpeed(r),
          r,
        }
      })
      nodes.forEach((node) => {
        node.style.left = '0'
        node.style.top = '0'
        node.style.willChange = 'translate'
      })
      const draw = () =>
        balls.forEach((b, i) => (nodes[i].style.translate = `${b.x - b.r}px ${b.y - b.r}px`))
      const onResize = () => {
        balls.forEach((b, i) => {
          b.r = nodes[i].offsetWidth / 2
          clampToBounds(b, bounds())
        })
        draw()
      }
      window.addEventListener('resize', onResize)
      let last = performance.now()
      const tick = (now: number) => {
        stepBalls(balls, (now - last) / 1000, bounds())
        last = now
        draw()
        frame = requestAnimationFrame(tick)
      }
      draw()
      frame = requestAnimationFrame(tick)
      cleanup = () => window.removeEventListener('resize', onResize)
    }
    let cleanup = () => {}
    // Safari has no requestIdleCallback: a plain timeout stands in.
    const hasIdle = typeof window.requestIdleCallback === 'function'
    const idle = hasIdle
      ? window.requestIdleCallback(() => void start(), { timeout: IDLE_TIMEOUT_MS })
      : setTimeout(() => void start(), IDLE_TIMEOUT_MS)
    return () => {
      stopped = true
      if (hasIdle) window.cancelIdleCallback(idle as number)
      else clearTimeout(idle)
      cancelAnimationFrame(frame)
      cleanup()
    }
  }, [root])
}
