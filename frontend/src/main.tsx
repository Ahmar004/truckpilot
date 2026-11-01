import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import { AppProviders } from './app/AppProviders'
import { AppRoutes } from './app/AppRoutes'
import { ErrorBoundary } from './app/ErrorBoundary'

// Load the landing chunk before hydrating "/", so the lazy page is ready and keeps its server HTML.
const { pathname: rawPath } = window.location
const pathname = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') : rawPath
if (pathname === '/') await import('./pages/Landing/Landing')
if (pathname === '/privacy') await import('./pages/Privacy/Privacy')

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

// Prerendered pages (/, /sign-in and /privacy) already hold markup; app.html and dev start empty.
if (root.hasChildNodes()) hydrateRoot(root, app)
else createRoot(root).render(app)
