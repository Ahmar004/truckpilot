import { Outlet } from 'react-router'
import { ThemeToggle } from '../components/ThemeToggle'
import { UnitsToggle } from '../components/UnitsToggle'
import { Wordmark } from '../components/Wordmark'
import { FloatingHeader } from '../components/ui/FloatingHeader'
import { useTheme } from '../hooks/useTheme'
import { useUnits } from '../hooks/useUnits'

/** Shared layout (design 5): the floating header over every page. */
export function Layout() {
  const { theme, toggleTheme } = useTheme()
  const { units, setUnits } = useUnits()

  return (
    <>
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
            <UnitsToggle value={units} onChange={setUnits} />
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </>
        }
      />
      <main id="main">
        <Outlet />
      </main>
    </>
  )
}
