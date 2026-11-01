import { Link } from 'react-router'
import { Truck } from './ui/icons'

/** The product name and logo; links home. */
export function Wordmark() {
  return (
    <Link
      to="/"
      className="text-text font-display flex items-center gap-2 rounded-full px-2 text-lg font-extrabold focus-visible:outline-2 focus-visible:outline-accent"
    >
      <Truck aria-hidden weight="fill" className="text-accent size-6" />
      Truck Pilot
    </Link>
  )
}
