import { cn } from '../../lib/cn'

// Literal class names so Tailwind sees them at build time (UIi 6.5).
const COLOR_CYCLE = [
  'text-weather-display',
  'text-load-display',
  'text-accent',
  'text-time-display',
  'text-warning',
] as const

/** Two-digit step number, colored from a fixed cycle by its position. */
export function BigNumber({ n, className }: { n: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'font-display font-extrabold tracking-tight tabular-nums',
        COLOR_CYCLE[(n - 1 + COLOR_CYCLE.length) % COLOR_CYCLE.length],
        className,
      )}
    >
      {String(n).padStart(2, '0')}
    </span>
  )
}
