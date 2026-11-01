import { Route, Routes } from 'react-router'
import { NotFound } from '../pages/NotFound/NotFound'
import { Layout } from './Layout'

/**
 * Route table. Later slices add their pages here: landing at "/" (16), sign-in (10), planner at
 * "/plan" (11) and privacy (Step-9). Until then "/" and "/sign-in" show the layout only, so the
 * build can prerender their shell without invented content.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={null} />
        <Route path="sign-in" element={null} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
