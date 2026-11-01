import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'

const SKELETON_CARDS = [0, 1, 2]

/** What the panel shows while a plan is in progress (design 8.6, Planning). */
export function PlanningState({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div
        role="progressbar"
        aria-label="Planning your trip"
        className="bg-border/60 h-1.5 w-full overflow-hidden rounded-full"
      >
        <div className="animate-shimmer h-full w-full bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--border)_0%,var(--accent)_50%,var(--border)_100%)]" />
      </div>
      <p role="status" className="text-text-muted text-center text-sm">
        Planning your trip. This can take up to 10 seconds.
      </p>
      <div className="flex flex-col gap-3">
        {SKELETON_CARDS.map((n) => (
          <Skeleton key={n} className="h-28 w-full rounded-lg" />
        ))}
      </div>
      <Button variant="ghost" size="sm" onClick={onCancel} className="self-center">
        Cancel
      </Button>
    </div>
  )
}
