import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router'
import { AppProviders } from './app/AppProviders'
import { AppRoutes } from './app/AppRoutes'
import { ErrorBoundary } from './app/ErrorBoundary'

/** Render one route to an HTML string for the build (architecture 12.2). */
export function render(url: string): string {
  return renderToString(
    <StaticRouter location={url}>
      <AppProviders>
        <ErrorBoundary>
          <AppRoutes />
        </ErrorBoundary>
      </AppProviders>
    </StaticRouter>,
  )
}
