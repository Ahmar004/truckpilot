import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router'
import { AppProviders } from './app/AppProviders'
import { AppRoutes } from './app/AppRoutes'
import { ErrorBoundary } from './app/ErrorBoundary'
import { Landing } from './pages/Landing/Landing'
import { Privacy } from './pages/Privacy/Privacy'

/** Render one route to an HTML string for the build (architecture 12.2). */
export function render(url: string): string {
  return renderToString(
    <StaticRouter location={url}>
      <AppProviders>
        <ErrorBoundary>
          <AppRoutes Landing={Landing} Privacy={Privacy} />
        </ErrorBoundary>
      </AppProviders>
    </StaticRouter>,
  )
}
