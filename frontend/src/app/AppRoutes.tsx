import { Route, Routes } from 'react-router'
import { NotFound } from '../pages/NotFound/NotFound'
import { SignIn } from '../pages/SignIn/SignIn'
import { Layout } from './Layout'
import { RequireSession } from './RequireSession'

/**
 * Route table. Later slices add their pages here: landing at "/" (16), the planner at "/plan"
 * (11) and privacy (Step-9). Until then "/" shows the layout only, and "/plan" shows the header
 * behind the sign-in guard, so the build can prerender without invented content.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={null} />
        <Route path="sign-in" element={<SignIn />} />
        <Route path="plan" element={<RequireSession>{null}</RequireSession>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
