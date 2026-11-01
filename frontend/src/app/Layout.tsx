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

/** Shared layout (design 5): the floating header over every page. */
export function Layout() {
  const { theme, toggleTheme } = useTheme()
  const { units, setUnits } = useUnits()
  const { pathname } = useLocation()
  const onPlanner = pathname === ROUTE_PATH.PLAN
  const onSignIn = pathname === ROUTE_PATH.SIGN_IN
  const onHome = pathname === ROUTE_PATH.HOME
  const onPrivacy = pathname === ROUTE_PATH.PRIVACY

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
            {!onSignIn && <UnitsToggle value={units} onChange={setUnits} />}
            {onPlanner ? <AccountControls /> : <ThemeToggle theme={theme} onToggle={toggleTheme} />}
            {(onHome || onPrivacy) && (
              <PillLink to={ROUTE_PATH.SIGN_IN} size="sm">
                Sign in
              </PillLink>
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
