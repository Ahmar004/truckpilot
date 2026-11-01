import { lazy, Suspense } from 'react'
import type { ComponentType } from 'react'
import { Route, Routes } from 'react-router'
import { Skeleton } from '../components/ui/Skeleton'
import { NotFound } from '../pages/NotFound/NotFound'
import { SignIn } from '../pages/SignIn/SignIn'
import { Layout } from './Layout'
import { RequireSession } from './RequireSession'

const Planner = lazy(() => import('../pages/Planner/Planner'))
/** The landing page is its own chunk (own 150 KB budget). The prerender passes it in directly. */
const LazyPrivacy = lazy(() =>
  import('../pages/Privacy/Privacy').then((m) => ({ default: m.Privacy })),
)
const LazyLanding = lazy(() =>
  import('../pages/Landing/Landing').then((m) => ({ default: m.Landing })),
)

/**
 * Route table. The planner
 * loads lazily behind the sign-in guard, so MapLibre stays out of the landing and sign-in bundles.
 */
export function AppRoutes({
  Landing = LazyLanding,
  Privacy = LazyPrivacy,
}: {
  Landing?: ComponentType
  Privacy?: ComponentType
}) {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route
          index
          element={
            <Suspense fallback={null}>
              <Landing />
            </Suspense>
          }
        />
        <Route
          path="privacy"
          element={
            <Suspense fallback={null}>
              <Privacy />
            </Suspense>
          }
        />
        <Route path="sign-in" element={<SignIn />} />
        <Route
          path="plan"
          element={
            <RequireSession>
              <Suspense fallback={<Skeleton className="fixed inset-0 rounded-none" />}>
                <Planner />
              </Suspense>
            </RequireSession>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
