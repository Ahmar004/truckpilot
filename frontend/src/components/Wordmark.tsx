import { Link } from 'react-router'
import { Truck } from './ui/icons'

/** The product name and logo; links home. On narrow phones only the logo shows (the name stays
 * for screen readers); below 22rem it hides, so the header keeps one row (Step-14). */
export function Wordmark() {
  return (
    <Link
      to="/"
      className="text-text font-display flex shrink-0 items-center max-[22rem]:hidden gap-2 rounded-full px-1 text-lg sm:px-2 font-extrabold focus-visible:outline-2 focus-visible:outline-accent"
    >
      <Truck aria-hidden weight="fill" className="text-accent size-6" />
      <span className="whitespace-nowrap max-[28rem]:sr-only">Truck Pilot</span>
    </Link>
  )
}
