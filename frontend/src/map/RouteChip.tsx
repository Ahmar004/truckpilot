import { Flag, Truck } from '../components/ui/icons'
import { cn } from '../lib/cn'

type RouteChipProps = {
  /** "1st best" */
  rank: string
  /** "1st": shown alone, in a smaller pill, when the map is zoomed far out (Step-14b). */
  shortRank: string
  compact: boolean
  /** "15 h 20 min" */
  travelTime: string
  selected: boolean
  onSelect: () => void
}

/** The pill at a route's midpoint (design 8.5). A focusable button, so the keyboard can pick a
 * route. Its background is see-through so a line under it still shows (Step-14b). */
export function RouteChip({
  rank,
  shortRank,
  compact,
  travelTime,
  selected,
  onSelect,
}: RouteChipProps) {
  return (
    <button
      type="button"
      aria-label={`Select ${rank} route`}
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'border-border focus-visible:outline-accent shadow-card rounded-full border font-bold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2',
        compact ? 'px-2 py-0.5 text-[0.6875rem]' : 'px-3 py-1 text-xs',
        selected ? 'bg-surface/80 text-text' : 'bg-surface/70 text-text-muted',
      )}
    >
      {compact ? shortRank : `${rank} · ${travelTime}`}
    </button>
  )
}

/** Origin: a white circle with a dark ring (design 8.5). */
export function OriginMarker() {
  return (
    <span
      aria-hidden
      className="block size-4 rounded-full border-[3px] border-[#1f2328] bg-white shadow-card"
    />
  )
}

/** Destination: a dark pin with a flag, not red because red means Severe here (design 8.5). */
export function DestinationMarker() {
  return (
    <span
      aria-hidden
      className="shadow-card grid size-8 place-items-center rounded-full border-2 border-white bg-[#1f2328] text-white"
    >
      <Flag size={16} weight="fill" />
    </span>
  )
}

/** The truck: an accent circle with a Truck icon (design 8.5). */
export function TruckMarker() {
  return (
    <span
      aria-hidden
      className="bg-accent text-accent-ink shadow-card grid size-9 place-items-center rounded-full border-2 border-white"
    >
      <Truck size={18} weight="fill" />
    </span>
  )
}
