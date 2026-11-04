import { Link } from 'react-router'
import { PROVIDER_LINKS, ROUTE_PATH, SECTION_ID } from '../lib/constants'

const LINK_CLASS =
  'text-text font-semibold underline-offset-4 hover:text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent'
const ROW_CLASS = 'flex flex-wrap justify-center gap-x-6 gap-y-2'

const PRODUCT_ANCHORS = [
  { id: SECTION_ID.HOW_IT_WORKS, label: 'How it works' },
  { id: SECTION_ID.INSIDE_THE_PLANNER, label: 'Inside the planner' },
  { id: SECTION_ID.FAQ, label: 'FAQ' },
] as const

/** Open footer (UIi 5.4, Step-14b): a hairline, then two centred rows - the product links, and
 * the data credits the map no longer shows in its corner. */
export function SiteFooter() {
  return (
    <footer className="border-border mt-16 flex flex-col items-center gap-5 border-t px-(--edge) pt-8 pb-8 text-center">
      <nav aria-label="Product">
        <ul className={ROW_CLASS}>
          {PRODUCT_ANCHORS.map((anchor) => (
            <li key={anchor.id}>
              <Link to={`${ROUTE_PATH.GUIDE}#${anchor.id}`} className={LINK_CLASS}>
                {anchor.label}
              </Link>
            </li>
          ))}
          <li>
            <Link to={ROUTE_PATH.HOME} className={LINK_CLASS}>
              Try TruckPilot
            </Link>
          </li>
          <li>
            <Link to={ROUTE_PATH.PRIVACY} className={LINK_CLASS}>
              Privacy
            </Link>
          </li>
        </ul>
      </nav>
      <nav aria-label="Data" className="flex flex-col items-center gap-2">
        <p className="text-text-muted text-xs font-extrabold tracking-widest uppercase">
          Map, route, place and weather data
        </p>
        <ul className={`${ROW_CLASS} text-sm`}>
          {PROVIDER_LINKS.map((provider) => (
            <li key={provider.name}>
              <a
                href={provider.href}
                target="_blank"
                rel="noopener noreferrer"
                className={LINK_CLASS}
              >
                {provider.name}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </footer>
  )
}
