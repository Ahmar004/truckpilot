import type { CSSProperties } from 'react'
import { LockSection } from '../../components/ui/LockSection'
import { SpriteArt } from '../../components/ui/SpriteArt'
import { SECTION_ID } from '../../lib/constants'
import { POSTERS } from './landingContent'
import './Landing.css'

/**
 * Section 5 (UIi 9.4): five posters in one row that pins and slides right to left as you
 * scroll, after a short hold, with a progress bar under it. Phones, reduced motion and browsers
 * without scroll timelines get a focusable swipe row instead.
 */
export function InsideThePlanner() {
  return (
    <LockSection
      id={SECTION_ID.INSIDE_THE_PLANNER}
      titleId="inside-title"
      label="INSIDE THE PLANNER"
      title="What you see after you plan."
      className="scroll-mt-24 py-16"
      bodyClassName="flex flex-col gap-8"
    >
      <div className="track" style={{ '--count': POSTERS.length } as CSSProperties}>
        <div className="track-stage">
          <ul
            aria-label="Planner screens, scroll sideways"
            tabIndex={0}
            className="track-row focus-visible:outline-accent focus-visible:outline-2"
          >
            {POSTERS.map((poster) => (
              <li key={poster.title} className="flex flex-col gap-3">
                <div className="border-border bg-surface shadow-card overflow-hidden rounded-lg border">
                  <SpriteArt art={poster.art} />
                </div>
                <h3 className="text-text text-xl font-extrabold">{poster.title}</h3>
                <p className="text-text-muted">{poster.line}</p>
              </li>
            ))}
          </ul>
          <div aria-hidden className="track-progress">
            <span />
          </div>
        </div>
      </div>
    </LockSection>
  )
}
