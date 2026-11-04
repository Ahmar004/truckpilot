import { angleAround, coastStep, roadPath, shortestDelta, SPIN_TAU_MS } from './scenes'
import { ballSpeed, stepBalls } from './hueMotion'
import type { Ball } from './hueMotion'

describe('roadPath (UIi 9.5)', () => {
  it('swings between the markers at 62% and 38%, one row per stop', () => {
    expect(roadPath(4)).toBe(
      'M62 12.5 C62 25 38 25 38 37.5 C38 50 62 50 62 62.5 C62 75 38 75 38 87.5',
    )
  })
  it('works for five stops', () => {
    expect(roadPath(5).startsWith('M62 10 C62 20 38 20 38 30')).toBe(true)
    expect(roadPath(5).endsWith('62 90')).toBe(true)
  })
})

describe('wheel angles (UIi 9.6)', () => {
  it('takes the short way round', () => {
    expect(shortestDelta(350, 10)).toBe(20)
    expect(shortestDelta(10, 350)).toBe(-20)
    expect(shortestDelta(0, 180)).toBe(180)
  })
  it('measures the pointer angle clockwise from straight up', () => {
    expect(angleAround(0, 0, 0, -10)).toBeCloseTo(0)
    expect(angleAround(0, 0, 10, 0)).toBeCloseTo(90)
  })
  it('coasts with exponential decay, frame-rate independent', () => {
    const one = coastStep(0.5, 32)
    const a = coastStep(0.5, 16)
    const b = coastStep(a.speed, 16)
    expect(a.delta + b.delta).toBeCloseTo(one.delta)
    expect(one.speed).toBeCloseTo(0.5 * Math.exp(-32 / SPIN_TAU_MS))
  })
})

describe('hue balls (UIi 4.2)', () => {
  const bounds = { width: 1000, height: 800 }
  it('bounces off a wall', () => {
    const balls: Ball[] = [{ x: 101, y: 400, vx: -ballSpeed(100), vy: 0, r: 100 }]
    stepBalls(balls, 0.05, bounds)
    expect(balls[0].vx).toBeGreaterThan(0)
    expect(balls[0].x).toBeGreaterThanOrEqual(100)
  })
  it('never leaves two balls overlapping and keeps their calm speed', () => {
    const balls: Ball[] = [
      { x: 400, y: 400, vx: 50, vy: 0, r: 100 },
      { x: 590, y: 400, vx: -50, vy: 0, r: 100 },
    ]
    stepBalls(balls, 0.05, bounds)
    expect(Math.hypot(balls[1].x - balls[0].x, balls[1].y - balls[0].y)).toBeGreaterThanOrEqual(
      199.9,
    )
    expect(Math.hypot(balls[0].vx, balls[0].vy)).toBeCloseTo(ballSpeed(100))
    expect(balls[0].vx).toBeLessThan(0)
  })
  it('caps a long frame so a ball never tunnels', () => {
    const balls: Ball[] = [{ x: 500, y: 400, vx: ballSpeed(100), vy: 0, r: 100 }]
    stepBalls(balls, 5, bounds)
    expect(balls[0].x).toBeCloseTo(500 + ballSpeed(100) * 0.05)
  })
})
