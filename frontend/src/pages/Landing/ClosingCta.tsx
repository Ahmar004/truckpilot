import { PillLink } from '../../components/ui/PillLink'
import { ROUTE_PATH } from '../../lib/constants'

/** Section 9: the closing call to action. */
export function ClosingCta() {
  return (
    <section
      aria-labelledby="closing-title"
      className="reveal flex flex-col items-center gap-8 py-24 text-center"
    >
      <h2
        id="closing-title"
        className="text-text text-4xl font-extrabold tracking-tight sm:text-6xl"
      >
        Plan your next trip.
      </h2>
      <PillLink to={ROUTE_PATH.HOME} size="lg">
        Try TruckPilot
      </PillLink>
    </section>
  )
}
