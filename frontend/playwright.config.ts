import { defineConfig } from '@playwright/test'

// End to end tests (architecture 13): the production build served by `vite preview` on 5173 with
// the vercel.json CSP (proxies /api; Step-14, so build-only bugs show up) plus Django with
// E2E_MODE on port 8000, on the separate local database `truckpilot_e2e` (backend/e2e_server.py).
// Windows: the backend command runs through uv.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure' },
  projects: [
    { name: 'phone-390', use: { viewport: { width: 390, height: 844 } } },
    { name: 'desktop-1280', use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: [
    {
      command: 'uv run python e2e_server.py',
      cwd: '../backend',
      url: 'http://127.0.0.1:8000/api/csrf',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      // Analytics keys are blanked so test runs never reach Sentry or PostHog.
      command: 'npm run build && npx vite preview --port 5173 --strictPort',
      env: { VITE_SENTRY_DSN: '', VITE_POSTHOG_KEY: '' },
      url: 'http://localhost:5173',
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
})
