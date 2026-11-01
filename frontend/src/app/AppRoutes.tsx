import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import { Skeleton } from '../components/ui/Skeleton'
import { NotFound } from '../pages/NotFound/NotFound'
import { SignIn } from '../pages/SignIn/SignIn'
import { Layout } from './Layout'
import { RequireSession } from './RequireSession'

const Planner = lazy(() => import('../pages/Planner/Planner'))

/**
 * Route table. Later slices add their pages here: landing at "/" (16), privacy (Step-9). The planner
 * loads lazily behind the sign-in guard, so MapLibre stays out of the landing and sign-in bundles.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={null} />
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
