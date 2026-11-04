// Pure helpers for the landing's scroll scenes (UIi 9.5 winding road, 9.6 FAQ wheel). No DOM.

/**
 * The winding road's path in a 0-100 box (the SVG stretches to the road). Markers alternate at
 * x 62 and 38, one row per stop; S-curves with a vertical tangent at every marker.
 */
export function roadPath(count: number): string {
  const row = 100 / count
  const points = Array.from({ length: count }, (_, i) => ({
    x: i % 2 === 0 ? 62 : 38,
    y: (i + 0.5) * row,
  }))
  return points
    .map((p, i) => {
      const prev = points[i - 1]
      if (!prev) return `M${p.x} ${p.y}`
      const mid = (prev.y + p.y) / 2
      return `C${prev.x} ${mid} ${p.x} ${mid} ${p.x} ${p.y}`
    })
    .join(' ')
}

/** Signed turn from one angle to another the short way round, in degrees (-180, 180]. */
export function shortestDelta(from: number, to: number): number {
  const wrapped = (((to - from + 180) % 360) + 360) % 360
  return wrapped === 0 ? 180 : wrapped - 180
}

/** Pointer angle around a centre, clockwise from straight up, in degrees. */
export function angleAround(cx: number, cy: number, x: number, y: number): number {
  return (Math.atan2(x - cx, cy - y) * 180) / Math.PI
}

/** Only the last 100 ms before release count toward a flick; a pause gives zero. */
export const FLICK_WINDOW_MS = 100
/** Decay time constant of a coasting wheel. */
export const SPIN_TAU_MS = 650
/** Below this speed (deg/ms) the wheel stops. */
export const SPIN_STOP_SPEED = 0.003
/** About two turns a second. */
export const SPIN_MAX_SPEED = 0.72
/** A press becomes a drag only after this much travel. */
export const DRAG_START_PX = 6
/** A slow frame is cut to this, so the wheel never jumps. */
export const MAX_FRAME_MS = 50
/** An arrow key turns the wheel by one cabin over this long. */
export const KEY_TURN_MS = 450

/** One coasting frame: the exact integral of exponential decay, so frame rate does not matter. */
export function coastStep(speed: number, dt: number): { delta: number; speed: number } {
  const fade = Math.exp(-dt / SPIN_TAU_MS)
  return { delta: speed * SPIN_TAU_MS * (1 - fade), speed: speed * fade }
}

/** Ease in and out, 0..1 to 0..1. */
export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}
