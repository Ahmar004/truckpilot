import type { CSSProperties } from 'react'
import { Button } from '../components/ui/Button'
import { CircleNotch } from '../components/ui/icons'
import { MapPin } from '../components/ui/plannerIcons'
import { searchLimitText } from '../lib/limitText'
import { PICK_STATUS } from '../lib/constants'
import type { PickStatus } from '../lib/constants'

type MapPickBarProps = {
  /** "Origin" or "Destination". */
  fieldLabel: string
  status: PickStatus
  retryAfterMin?: number
  isDesktop: boolean
  onCancel: () => void
  style?: CSSProperties
}

function message(status: PickStatus, fieldLabel: string, isDesktop: boolean, minutes: number) {
  switch (status) {
    case PICK_STATUS.LOOKING:
      return 'Finding the address...'
    case PICK_STATUS.OUTSIDE:
      return 'Pick a point in the US or Canada.'
    case PICK_STATUS.ERROR:
      return `Place search unavailable. ${isDesktop ? 'Click' : 'Tap'} the map to try again.`
    case PICK_STATUS.LIMIT:
      return searchLimitText(minutes)
    default:
      return `${isDesktop ? 'Click' : 'Tap'} the map to set your ${fieldLabel}.`
  }
}

/** The prompt over the map while "Choose on map" is on (Step-14b). Esc also cancels. */
export function MapPickBar({
  fieldLabel,
  status,
  retryAfterMin,
  isDesktop,
  onCancel,
  style,
}: MapPickBarProps) {
  const looking = status === PICK_STATUS.LOOKING
  const problem =
    status === PICK_STATUS.OUTSIDE || status === PICK_STATUS.ERROR || status === PICK_STATUS.LIMIT
  return (
    <div className="pointer-events-none absolute z-10 flex justify-center" style={style}>
      <div className="bg-surface border-border shadow-card-hover pointer-events-auto flex max-w-full items-center gap-3 rounded-full border py-1.5 pr-1.5 pl-4">
        {looking ? (
          <CircleNotch aria-hidden size={18} className="text-text-muted shrink-0 animate-spin" />
        ) : (
          <MapPin aria-hidden size={18} weight="fill" className="text-accent shrink-0" />
        )}
        <p role="status" className={`text-sm font-bold ${problem ? 'text-warning' : 'text-text'}`}>
          {message(status, fieldLabel, isDesktop, retryAfterMin ?? 1)}
        </p>
        <Button size="sm" variant="outline" onClick={onCancel} className="shrink-0">
          Cancel
        </Button>
      </div>
    </div>
  )
}
