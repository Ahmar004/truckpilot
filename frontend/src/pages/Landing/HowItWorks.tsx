import { BigNumber } from '../../components/ui/BigNumber'
import { PillLink } from '../../components/ui/PillLink'
import { SectionHeading } from '../../components/ui/SectionHeading'
import { SpriteArt } from '../../components/ui/SpriteArt'
import { cn } from '../../lib/cn'
import { ROUTE_PATH, SECTION_ID } from '../../lib/constants'
import { STOPS } from './landingContent'
import './Landing.css'

/** Section 4: five numbered stops along a dotted road. */
export function HowItWorks() {
  return (
    <section
      id={SECTION_ID.HOW_IT_WORKS}
      aria-labelledby="how-title"
      className="flex scroll-mt-24 flex-col gap-12 py-16"
    >
      <SectionHeading
        id="how-title"
        label="HOW IT WORKS"
        title="From your trip to one recommended route."
      />
      <ol className="road flex flex-col gap-14">
        {STOPS.map((stop, i) => (
          <li
            key={stop.title}
            className="scene grid items-center gap-5 pl-8 sm:pl-12 lg:grid-cols-2 lg:gap-12"
          >
            <div className={cn('flex flex-col items-start gap-2', i % 2 === 1 && 'lg:order-2')}>
              <BigNumber n={i + 1} className="text-6xl sm:text-7xl" />
              <h3 className="text-text text-2xl font-extrabold sm:text-3xl">{stop.title}</h3>
              <p className="text-text-muted text-lg">{stop.line}</p>
              {i === STOPS.length - 1 && (
                <PillLink to={ROUTE_PATH.HOME} className="mt-3">
                  Plan your trip
                </PillLink>
              )}
            </div>
            <div className="w-full max-w-md">
              <SpriteArt art={stop.art} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
