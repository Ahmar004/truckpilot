import { BigNumber } from '../../components/ui/BigNumber'
import { LockSection } from '../../components/ui/LockSection'
import { PillLink } from '../../components/ui/PillLink'
import { SpriteArt } from '../../components/ui/SpriteArt'
import { ROUTE_PATH, SECTION_ID } from '../../lib/constants'
import { roadPath } from '../../lib/scenes'
import { STOPS } from './landingContent'
import './Landing.css'

const ROAD = roadPath(STOPS.length)

/**
 * Section 4 (UIi 9.5): five stops alternate left and right of a dotted road that swings between
 * their markers. The road draws itself as you scroll, each card rises and its marker pops. On
 * phones the road is a straight dotted line beside the stops.
 */
export function HowItWorks() {
  return (
    <LockSection
      id={SECTION_ID.HOW_IT_WORKS}
      titleId="how-title"
      label="HOW IT WORKS"
      title="From your trip to one recommended route."
      className="scroll-mt-24 py-16"
      bodyClassName="flex flex-col gap-12"
    >
      <div className="road">
        <svg
          aria-hidden
          className="road-line"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          fill="none"
        >
          <path d={ROAD} vectorEffect="non-scaling-stroke" />
        </svg>
        <span aria-hidden className="road-trail" />
        <ol className="road-stops">
          {STOPS.map((stop, i) => (
            <li key={stop.title} className="road-stop" data-side={i % 2 === 0 ? 'left' : 'right'}>
              <span aria-hidden className="road-marker" />
              <div className="road-card">
                <div className="road-art">
                  <SpriteArt art={stop.art} />
                </div>
                <BigNumber n={i + 1} className="text-5xl sm:text-6xl" />
                <h3 className="text-text text-2xl font-extrabold sm:text-3xl">{stop.title}</h3>
                <p className="text-text-muted text-lg">{stop.line}</p>
                {i === STOPS.length - 1 && (
                  <PillLink to={ROUTE_PATH.HOME} className="mt-2">
                    Plan your trip
                  </PillLink>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </LockSection>
  )
}
