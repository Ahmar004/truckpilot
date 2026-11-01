import { Link } from 'react-router'
import { CaretDown } from '../../components/ui/icons'
import { SectionHeading } from '../../components/ui/SectionHeading'
import { SpriteArt } from '../../components/ui/SpriteArt'
import { useFaqCabins } from '../../hooks/useFaqCabins'
import { ART } from '../../lib/art'
import { cn } from '../../lib/cn'
import { ROUTE_PATH, SECTION_ID } from '../../lib/constants'
import { FAQ_ITEMS } from './landingContent'
import './Landing.css'

/**
 * Section 8: eight cabins on a wheel. Each question is a real button with aria-expanded, and the
 * arrow keys move between them. The rim turns slowly where motion is allowed; with reduced motion
 * the section is a plain list.
 */
export function FaqWheel() {
  const { open, toggle, onKeyDown, register } = useFaqCabins(FAQ_ITEMS.length)
  return (
    <section
      id={SECTION_ID.FAQ}
      aria-labelledby="faq-title"
      className="grid scroll-mt-24 items-start gap-10 py-16 lg:grid-cols-[1fr_2fr] lg:gap-16"
    >
      <div className="flex flex-col gap-8">
        <SectionHeading id="faq-title" label="FAQ" title="Questions drivers ask." />
        <div className="mx-auto hidden w-full max-w-xs lg:block" aria-hidden>
          <div className="faq-rim">
            <SpriteArt art={ART.FAQ_RIM} />
          </div>
          <SpriteArt art={ART.FAQ_STAND} className="mx-auto -mt-40 w-1/2" />
        </div>
      </div>
      <ul className="flex flex-col gap-3">
        {FAQ_ITEMS.map((item, i) => {
          const isOpen = open === i
          return (
            <li key={item.q} className="border-border bg-surface/70 rounded-lg border">
              <h3>
                <button
                  type="button"
                  ref={(el) => register(i, el)}
                  id={`faq-q-${i}`}
                  aria-expanded={isOpen}
                  aria-controls={`faq-a-${i}`}
                  onClick={() => toggle(i)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                  className="text-text focus-visible:outline-accent flex w-full items-center justify-between gap-4 rounded-lg p-4 text-left text-lg font-extrabold focus-visible:outline-2"
                >
                  {item.q}
                  <CaretDown
                    aria-hidden
                    weight="bold"
                    className={cn('size-5 shrink-0 transition-transform', isOpen && 'rotate-180')}
                  />
                </button>
              </h3>
              <div
                id={`faq-a-${i}`}
                role="region"
                aria-labelledby={`faq-q-${i}`}
                hidden={!isOpen}
                className="text-text-muted px-4 pb-4 text-lg"
              >
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
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
