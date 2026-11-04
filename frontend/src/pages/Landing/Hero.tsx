import { PillLink } from '../../components/ui/PillLink'
import { SectionLabel } from '../../components/ui/SectionLabel'
import { SpriteArt } from '../../components/ui/SpriteArt'
import { ART } from '../../lib/art'
import { ROUTE_PATH, SECTION_ID } from '../../lib/constants'
import './Landing.css'

const HEADLINE = 'Pick the safest truck route before you roll.'
const WORD_STEP_MS = 60
const WORD_DELAY_MAX_MS = 600

/** Section 1: label, the page's one h1 (words rise in turn), lead, two actions and the picture. */
export function Hero() {
  const words = HEADLINE.split(' ')
  return (
    <section
      aria-label="Introduction"
      className="grid min-h-[calc(100svh-7rem)] items-center gap-10 py-10 lg:grid-cols-2 lg:gap-12"
    >
      <div className="flex flex-col items-start gap-6">
        <SectionLabel>FOR TRUCK DRIVERS IN THE US AND CANADA</SectionLabel>
        <h1 className="text-text text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
          {words.map((word, i) => (
            <span key={i}>
              {i > 0 && ' '}
              <span
                className="hero-word"
                style={{ animationDelay: `${Math.min(i * WORD_STEP_MS, WORD_DELAY_MAX_MS)}ms` }}
              >
                {word}
              </span>
            </span>
          ))}
        </h1>
        <p className="text-text-muted max-w-xl text-xl sm:text-2xl">
          Truck Pilot checks the hourly forecast where your truck will be, when it will be there,
          and recommends one of up to 3 real truck routes.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <PillLink to={ROUTE_PATH.HOME} size="lg">
            Try TruckPilot
          </PillLink>
          <PillLink to={`#${SECTION_ID.HOW_IT_WORKS}`} variant="secondary" size="lg">
            See how it works
          </PillLink>
        </div>
      </div>
      <div className="hero-art-float mx-auto w-full max-w-xl">
        <SpriteArt art={ART.HERO} />
      </div>
    </section>
  )
}
