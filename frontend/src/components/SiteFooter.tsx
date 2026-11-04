import { Link } from 'react-router'
import { PROVIDER_LINKS, ROUTE_PATH, SECTION_ID } from '../lib/constants'

const LINK_CLASS =
  'text-text font-semibold underline-offset-4 hover:text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent'

const PRODUCT_ANCHORS = [
  { id: SECTION_ID.HOW_IT_WORKS, label: 'How it works' },
  { id: SECTION_ID.INSIDE_THE_PLANNER, label: 'Inside the planner' },
  { id: SECTION_ID.FAQ, label: 'FAQ' },
] as const

/** Open footer (UIi 5.4): hairline, two link columns and a giant outlined wordmark. */
export function SiteFooter() {
  return (
    <footer className="border-border mt-16 flex flex-col gap-10 border-t px-(--edge) pt-10 pb-6">
      <div className="grid grid-cols-2 gap-8 sm:max-w-xl">
        <nav aria-label="Product" className="flex flex-col gap-3">
          <p className="text-text-muted text-sm font-extrabold tracking-widest uppercase">
            Product
          </p>
          <ul className="flex flex-col gap-2">
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
        <nav aria-label="Data" className="flex flex-col gap-3">
          <p className="text-text-muted text-sm font-extrabold tracking-widest uppercase">Data</p>
          <ul className="flex flex-col gap-2">
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
      </div>
      <svg
        aria-hidden
        viewBox="0 0 1000 140"
        width={1000}
        height={140}
        className="block h-auto w-full"
      >
        <text
          x="0"
          y="104"
          textLength={1000}
          lengthAdjust="spacingAndGlyphs"
          fontSize={124}
          strokeWidth="1.5"
          className="font-display stroke-border-strong fill-none font-extrabold"
        >
          Truck Pilot
        </text>
      </svg>
    </footer>
  )
}
