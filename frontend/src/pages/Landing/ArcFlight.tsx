import { LockSection } from '../../components/ui/LockSection'
import { SpriteArt } from '../../components/ui/SpriteArt'
import { cn } from '../../lib/cn'
import { FACTORS } from './landingContent'
import './Landing.css'

/**
 * Section 3 (UIi 9.1): the heading locks, and each factor sweeps along an S curve while the
 * stage is pinned: in small from the top right, resting full size in the centre, out to the
 * bottom left. Without scroll timelines or under reduced motion it is a plain list.
 */
export function ArcFlight() {
  return (
    <LockSection
      titleId="factors-title"
      label="WHAT WE WEIGH"
      title="Three things decide your route."
      className="py-16"
      bodyClassName="flex flex-col gap-12"
    >
      <div className="flight">
        <ul className="flight-stage">
          {FACTORS.map((factor) => (
            <li key={factor.word} className="flight-scene">
              <span aria-hidden className={cn('flight-word', factor.tone)}>
                {factor.word}
              </span>
              <div className="flight-art">
                <SpriteArt art={factor.art} />
              </div>
              <div className="flight-caption flex max-w-xl flex-col gap-2 text-center">
                <h3 className="text-text text-2xl font-extrabold">{factor.name}</h3>
                <p className="text-text-muted text-lg sm:text-xl">{factor.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </LockSection>
  )
}
