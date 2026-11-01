import { SectionHeading } from '../../components/ui/SectionHeading'
import { SpriteArt } from '../../components/ui/SpriteArt'
import { SECTION_ID } from '../../lib/constants'
import { POSTERS } from './landingContent'

/** Section 5: five posters in a sideways row. A swipe row on phones, a focusable scroll region. */
export function InsideThePlanner() {
  return (
    <section
      id={SECTION_ID.INSIDE_THE_PLANNER}
      aria-labelledby="inside-title"
      className="flex scroll-mt-24 flex-col gap-8 py-16"
    >
      <SectionHeading
        id="inside-title"
        label="INSIDE THE PLANNER"
        title="What you see after you plan."
      />
      <div
        role="region"
        aria-label="Planner screens, scroll sideways"
        tabIndex={0}
        className="-mx-(--edge) snap-x snap-mandatory overflow-x-auto px-(--edge) pb-4 [scroll-padding-inline:var(--edge)]"
      >
        <ul className="flex w-max gap-5">
          {POSTERS.map((poster) => (
            <li
              key={poster.title}
              className="flex w-[80vw] max-w-md shrink-0 snap-start flex-col gap-3 sm:w-96"
            >
              <SpriteArt art={poster.art} />
              <h3 className="text-text text-xl font-extrabold">{poster.title}</h3>
              <p className="text-text-muted">{poster.line}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
