import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

// The CSP lives in vercel.json; `vite preview` also sends it (vite.config.ts). Apply the same value
// to every page here and fail on any violation, and on the map's worker failing to load (the
// Step-14 bug: MapLibre's worker file was missing from the build).
const vercel = JSON.parse(readFileSync(resolve(process.cwd(), '../vercel.json'), 'utf8'))
const CSP: string = vercel.headers[0].headers.find(
  (h: { key: string }) => h.key === 'Content-Security-Policy',
).value

test.use({ reducedMotion: 'reduce' })

for (const path of ['/', '/guide', '/privacy', '/plan']) {
  test(`CSP: ${path} causes no violations`, async ({ page, context }) => {
    if (path === '/plan' || path === '/') {
      const csrf = await context.request.get('/api/csrf')
      const { csrf_token } = await csrf.json()
      await context.request.post('/api/test/sign-in', { headers: { 'X-CSRFToken': csrf_token } })
    }
    await page.route('**/*', async (route) => {
      if (route.request().resourceType() !== 'document') return route.continue()
      const response = await route.fetch()
      await route.fulfill({
        response,
        headers: { ...response.headers(), 'content-security-policy': CSP },
      })
    })
    const problems: string[] = []
    page.on('console', (m) => {
      if (
        m.type() === 'error' &&
        /Content Security Policy|Refused to|Worker failed/i.test(m.text())
      )
        problems.push(m.text())
    })
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) =>
        console.error(`Refused to ${e.violatedDirective} ${e.blockedURI}`),
      )
    })
    await page.goto(path)
    await page.waitForTimeout(path === '/plan' || path === '/' ? 6000 : 2500)
    expect(problems).toEqual([])
  })
}
