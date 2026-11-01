import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

// The CSP lives in vercel.json (Vite dev does not send it). Apply the same value to every page
// here and fail on any violation the app causes. Vite's dev-only inline script and websocket are
// the only allowed exceptions; the production build has neither.
const vercel = JSON.parse(readFileSync(resolve(process.cwd(), '../vercel.json'), 'utf8'))
const CSP: string = vercel.headers[0].headers.find(
  (h: { key: string }) => h.key === 'Content-Security-Policy',
).value

const DEV_ONLY = /localhost:5173|ws:\/\/|inline/

test.use({ reducedMotion: 'reduce' })

for (const path of ['/', '/sign-in', '/privacy', '/plan']) {
  test(`CSP: ${path} causes no violations`, async ({ page, context }) => {
    if (path === '/plan') {
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
      if (m.type() === 'error' && /Content Security Policy|Refused to/i.test(m.text()))
        problems.push(m.text())
    })
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) =>
        console.error(`Refused to ${e.violatedDirective} ${e.blockedURI}`),
      )
    })
    await page.goto(path)
    await page.waitForTimeout(path === '/plan' ? 6000 : 2500)
    expect(problems.filter((p) => !DEV_ONLY.test(p))).toEqual([])
  })
}
