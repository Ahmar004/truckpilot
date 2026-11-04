// Physics of the three hue balls (UIi 4.2): slow billiard balls that move in straight lines,
// bounce elastically off the edges and each other, and never overlap. Pure, no DOM.

export type Ball = { x: number; y: number; vx: number; vy: number; r: number }
export type Bounds = { width: number; height: number }

/** Calm: 12% of its diameter per second. */
const SPEED_PER_DIAMETER = 0.12
const MIN_SPEED_PX = 18
/** A long frame (a tab coming back) never tunnels. */
export const MAX_STEP_S = 0.05

export const ballSpeed = (r: number) => Math.max(MIN_SPEED_PX, SPEED_PER_DIAMETER * 2 * r)

const clamp = (v: number, min: number, max: number) =>
  min > max ? (min + max) / 2 : Math.min(Math.max(v, min), max)

export function clampToBounds(b: Ball, s: Bounds) {
  b.x = clamp(b.x, b.r, s.width - b.r)
  b.y = clamp(b.y, b.r, s.height - b.r)
}

function walls(b: Ball, s: Bounds) {
  if (b.x - b.r < 0 && b.vx < 0) b.vx = -b.vx
  if (b.x + b.r > s.width && b.vx > 0) b.vx = -b.vx
  if (b.y - b.r < 0 && b.vy < 0) b.vy = -b.vy
  if (b.y + b.r > s.height && b.vy > 0) b.vy = -b.vy
  clampToBounds(b, s)
}

/** Elastic collision with mass = disc area; overlap is pushed apart first. */
export function collide(a: Ball, b: Ball) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const d = Math.hypot(dx, dy)
  const min = a.r + b.r
  if (d >= min) return
  const nx = d === 0 ? 1 : dx / d
  const ny = d === 0 ? 0 : dy / d
  const ma = a.r * a.r
  const mb = b.r * b.r
  const total = ma + mb
  const overlap = min - d
  a.x -= nx * overlap * (mb / total)
  a.y -= ny * overlap * (mb / total)
  b.x += nx * overlap * (ma / total)
  b.y += ny * overlap * (ma / total)
  const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny
  if (closing <= 0) return
  const impulse = (2 * closing) / total
  a.vx -= impulse * mb * nx
  a.vy -= impulse * mb * ny
  b.vx += impulse * ma * nx
  b.vy += impulse * ma * ny
}

export function stepBalls(balls: Ball[], seconds: number, s: Bounds) {
  const dt = Math.min(Math.max(seconds, 0), MAX_STEP_S)
  for (const b of balls) {
    b.x += b.vx * dt
    b.y += b.vy * dt
    walls(b, s)
  }
  // A ball pushed into a third settles too.
  for (let pass = 0; pass < 3; pass++) {
    balls.forEach((a, i) => {
      for (const b of balls.slice(i + 1)) collide(a, b)
    })
    for (const b of balls) clampToBounds(b, s)
  }
  // Hits only turn a ball; its speed stays calm.
  for (const b of balls) {
    const v = Math.hypot(b.vx, b.vy)
    if (v === 0) continue
    const k = ballSpeed(b.r) / v
    b.vx *= k
    b.vy *= k
  }
}
