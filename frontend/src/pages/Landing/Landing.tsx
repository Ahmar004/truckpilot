import { SiteFooter } from '../../components/SiteFooter'
import { useHashScroll } from '../../hooks/useHashScroll'
import { ArcFlight } from './ArcFlight'
import { ClosingCta } from './ClosingCta'
import { FaqWheel } from './FaqWheel'
import { Hero } from './Hero'
import { HowItWorks } from './HowItWorks'
import { InsideThePlanner } from './InsideThePlanner'
import { RiskLevels } from './RiskLevels'
import { WordBand } from './WordBand'

const FACTOR_WORDS = ['WEATHER', 'LOAD', 'TIME', 'ROUTES', 'CHECKPOINTS'] as const
const LEVEL_WORDS = ['LOW', 'MODERATE', 'HIGH', 'SEVERE', 'NO TRAVEL'] as const

/** Landing page (design 6): the ten sections in order. */
export function Landing() {
  useHashScroll()
  return (
    <>
      <div className="px-(--edge)">
        <Hero />
        <WordBand words={FACTOR_WORDS} direction="left" />
        <ArcFlight />
        <HowItWorks />
        <InsideThePlanner />
        <RiskLevels />
        <WordBand words={LEVEL_WORDS} direction="right" />
        <FaqWheel />
        <ClosingCta />
      </div>
      <SiteFooter />
    </>
  )
}
