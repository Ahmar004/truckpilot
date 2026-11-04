import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import { Plus } from '../../components/ui/icons'
import { LockSection } from '../../components/ui/LockSection'
import { SpriteArt } from '../../components/ui/SpriteArt'
import { useFaqWheel } from '../../hooks/useFaqWheel'
import { ART } from '../../lib/art'
import { ROUTE_PATH, SECTION_ID } from '../../lib/constants'
import { FAQ_ITEMS } from './landingContent'
import './Landing.css'

/**
 * Section 8 (UIi 9.6): the FAQ as a Ferris wheel, one cabin per question. On wide screens the
 * section pins: the wheel rolls in along the ground, the heading leaps out of its way, the wheel
 * hops onto its stand, the answer card appears at the hub and the wheel turns once. Elsewhere a
 * smaller wheel rolls in with the card under it. Cabins are real buttons; with reduced motion
 * everything sits in place.
 */
export function FaqWheel() {
  const { open, toggle, onKeyDown, onFocus, register, wheelRef, wheelHandlers } = useFaqWheel(
    FAQ_ITEMS.length,
  )
  const step = 360 / FAQ_ITEMS.length
  return (
    <LockSection
      id={SECTION_ID.FAQ}
      titleId="faq-title"
      label="FAQ"
      title="Questions drivers ask."
      className="faq-ride scroll-mt-24 py-16"
      headClassName="faq-ride-intro"
      renderBody={(head) => (
        <div className="faq-ride-stage">
          <div className="faq-ride-scene">
            {head}
            <div className="faq-machine">
              <svg
                aria-hidden
                className="faq-stand"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <path
                  d="M50 0 L12 100 M50 0 L88 100 M4 100 H96"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              <div
                ref={wheelRef}
                role="group"
                aria-label="FAQ wheel. Left and right arrow keys turn it."
                className="faq-wheel"
                {...wheelHandlers}
              >
                <SpriteArt art={ART.FAQ_RIM} className="faq-rim" />
                <ul className="faq-cabins">
                  {FAQ_ITEMS.map((item, i) => (
                    <li
                      key={item.q}
                      className="faq-slot"
                      style={{ '--a': `${i * step}deg` } as CSSProperties}
                    >
                      <button
                        type="button"
                        ref={(el) => register(i, el)}
                        id={`faq-q-${i}`}
                        aria-expanded={open === i}
                        aria-controls={`faq-a-${i}`}
                        aria-label={`${item.label}: ${item.q}`}
                        onClick={() => toggle(i)}
                        onKeyDown={(e) => onKeyDown(e, i)}
                        onFocus={onFocus}
                        className="faq-cabin"
                      >
                        <span>{item.label}</span>
                        <span aria-hidden className="faq-cabin-icon">
                          <Plus weight="bold" className="size-3.5" />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="faq-card">
              {open === null && (
                <p className="text-text-muted">
                  Pick a cabin to read its answer. Spin the wheel to see them all.
                </p>
              )}
              {FAQ_ITEMS.map((item, i) => (
                <div
                  key={item.q}
                  id={`faq-a-${i}`}
                  role="region"
                  aria-labelledby={`faq-a-title-${i}`}
                  hidden={open !== i}
                  className="faq-answer"
                >
                  <p id={`faq-a-title-${i}`} className="text-text font-extrabold">
                    {item.q}
                  </p>
                  <p className="text-text-muted">
                    {item.a}
                    {item.privacy && (
                      <>
                        {' '}
                        <Link
                          to={ROUTE_PATH.PRIVACY}
                          className="text-accent font-bold underline underline-offset-4"
                        >
                          Read the privacy page
                        </Link>
                        .
                      </>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    />
  )
}
