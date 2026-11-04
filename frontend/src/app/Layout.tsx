import { Outlet, useLocation } from 'react-router'
import { ThemeToggle } from '../components/ThemeToggle'
import { UnitsToggle } from '../components/UnitsToggle'
import { HueBackdrop } from '../components/HueBackdrop'
import { Wordmark } from '../components/Wordmark'
import { FloatingHeader } from '../components/ui/FloatingHeader'
import { PillLink } from '../components/ui/PillLink'
import { ROUTE_PATH } from '../lib/constants'
import { AccountControls } from './AccountControls'
import { useTheme } from '../hooks/useTheme'
import { useUnits } from '../hooks/useUnits'

/** On narrow phones the far-right link drops its arrow disc so the header stays one row; at
 * 320 px it also loses some padding, to make room for the theme button (Step-14b). */
const COMPACT_ON_PHONE = {
  className: 'max-[28rem]:gap-0 max-[28rem]:px-3 max-[22rem]:px-2',
  arrowClassName: 'max-[28rem]:hidden',
}

/** Shared layout (design 5): the floating header over every page. The link on the far right
 * goes to the guide from the planner, and back to the planner from every other page (Step-14).
 * On the planner the theme button sits between the units toggle and the account button (Step-14b). */
export function Layout() {
  const { theme, toggleTheme } = useTheme()
  const { units, setUnits } = useUnits()
  const { pathname } = useLocation()
  const onPlanner = pathname === ROUTE_PATH.HOME || pathname === ROUTE_PATH.PLAN

  return (
    <>
      {!onPlanner && <HueBackdrop />}
      <a
        href="#main"
        className="bg-surface text-text sr-only rounded-full px-4 py-2 font-bold focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
      >
        Skip to content
      </a>
      <FloatingHeader
        left={<Wordmark />}
        right={
          <>
            {onPlanner ? (
              <>
                <UnitsToggle value={units} onChange={setUnits} />
                <ThemeToggle theme={theme} onToggle={toggleTheme} />
                <AccountControls />
                <PillLink to={ROUTE_PATH.GUIDE} size="sm" {...COMPACT_ON_PHONE}>
                  Take a guide
                </PillLink>
              </>
            ) : (
              <>
                <ThemeToggle theme={theme} onToggle={toggleTheme} />
                <PillLink to={ROUTE_PATH.HOME} size="sm" {...COMPACT_ON_PHONE}>
                  Try TruckPilot
                </PillLink>
              </>
            )}
          </>
        }
      />
      <main id="main" className={onPlanner ? undefined : 'page-enter'}>
        <Outlet />
      </main>
    </>
  )
}
