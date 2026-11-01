import { SectionHeading } from '../../components/ui/SectionHeading'
import { SpriteArt } from '../../components/ui/SpriteArt'
import { cn } from '../../lib/cn'
import { FACTORS } from './landingContent'
import './Landing.css'

/** Section 3: three scenes, one per factor. Each rises in as it scrolls into view where supported. */
export function ArcFlight() {
  return (
    <section aria-labelledby="factors-title" className="flex flex-col gap-12 py-16">
      <SectionHeading
        id="factors-title"
        label="WHAT WE WEIGH"
        title="Three things decide your route."
      />
      <ul className="flex flex-col gap-16">
        {FACTORS.map((factor, i) => (
          <li key={factor.word} className="scene grid items-center gap-6 lg:grid-cols-2 lg:gap-12">
            <div className={cn('flex flex-col gap-4', i % 2 === 1 && 'lg:order-2')}>
              <h3
                className={cn(
                  'font-display text-6xl font-extrabold tracking-tight sm:text-8xl',
                  factor.tone,
                )}
              >
                {factor.word}
              </h3>
              <p className="text-text-muted max-w-xl text-xl sm:text-2xl">{factor.text}</p>
            </div>
            <div className="mx-auto w-full max-w-md">
              <SpriteArt art={factor.art} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
