import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import { AppProviders } from './app/AppProviders'
import { AppRoutes } from './app/AppRoutes'
import { ErrorBoundary } from './app/ErrorBoundary'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

const app = (
  <StrictMode>
    <BrowserRouter>
      <AppProviders>
        <ErrorBoundary>
          <AppRoutes />
        </ErrorBoundary>
      </AppProviders>
    </BrowserRouter>
  </StrictMode>
)

// Prerendered pages (/ and /sign-in) already hold markup; app.html and dev start empty.
if (root.hasChildNodes()) hydrateRoot(root, app)
else createRoot(root).render(app)
