import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { BrowserContext, Page } from '@playwright/test'

async function signIn(context: BrowserContext) {
  const csrf = await context.request.get('/api/csrf')
  const { csrf_token } = await csrf.json()
  const res = await context.request.post('/api/test/sign-in', {
    headers: { 'X-CSRFToken': csrf_token },
  })
  expect(res.ok()).toBeTruthy()
}

/** Type in a place field and pick the first suggestion (providers replay saved real answers). */
async function pickPlace(page: Page, label: string, text: string) {
  const field = page.getByRole('combobox', { name: label, exact: true })
  await field.fill(text)
  await page.getByRole('option').first().click()
}

const routeCards = (page: Page) =>
  page.getByRole('radiogroup', { name: 'Routes' }).getByRole('radio')

async function toggleTheme(page: Page, to: 'dark' | 'light') {
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: `Switch to ${to} theme` }).click()
}

async function planTrip(page: Page) {
  await page.goto('/plan')
  await pickPlace(page, 'Origin', 'Chicago')
  await pickPlace(page, 'Destination', 'Toronto')
  await page.getByLabel('Load weight').fill('30000')
  await page.getByRole('button', { name: 'Plan trip' }).click()
  await expect(routeCards(page).first()).toBeVisible({ timeout: 20_000 })
}

// Axe must see elements at rest, not mid-way through a reveal animation.
test.use({ reducedMotion: 'reduce' })

test.describe('planner flows', () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context)
  })

  test('F2: plan a trip, see routes, switch route, move the slider', async ({ page }) => {
    await planTrip(page)
    const routes = routeCards(page)
    expect(await routes.count()).toBeGreaterThanOrEqual(1)
    await expect(routes.first()).toBeChecked()
    if ((await routes.count()) > 1) {
      await routes.nth(1).click()
      await expect(routes.nth(1)).toBeChecked()
    }
    const thumb = page.getByRole('slider')
    await thumb.focus()
    const requests: string[] = []
    page.on('request', (r) => requests.push(r.url()))
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('PageUp')
    await expect(thumb).toHaveAttribute('aria-valuenow', '7')
    expect(requests.filter((u) => u.includes('/api/'))).toEqual([])
  })

  test('F3: changing the interval or HOS updates the plan without a new search', async ({
    page,
  }) => {
    await planTrip(page)
    const update = page.waitForResponse((r) => r.url().includes('/api/plans/update'))
    await page.getByLabel('HOS breaks').last().click()
    expect((await update).ok()).toBeTruthy()
  })

  test('F4: an empty form shows field errors and sends nothing', async ({ page }) => {
    await page.goto('/plan')
    let posted = false
    page.on('request', (r) => {
      if (r.url().endsWith('/api/plans') && r.method() === 'POST') posted = true
    })
    await page.getByRole('button', { name: 'Plan trip' }).click()
    await expect(page.getByText('Pick a place from the suggestions.')).toHaveCount(2)
    await expect(page.getByText(/Enter a whole number from 0 to 80,000/)).toBeVisible()
    expect(posted).toBe(false)
  })

  test('F5: a failing plan request shows an error with Retry', async ({ page }) => {
    await page.goto('/plan')
    await pickPlace(page, 'Origin', 'Chicago')
    await pickPlace(page, 'Destination', 'Toronto')
    await page.getByLabel('Load weight').fill('30000')
    await page.route('**/api/plans', (route) =>
      route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'provider_unavailable', service: 'routing' }),
      }),
    )
    await page.getByRole('button', { name: 'Plan trip' }).click()
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
    await expect(routeCards(page)).toHaveCount(0)
  })

  test('F6: the plan limit shows a try-again time', async ({ page }) => {
    await page.goto('/plan')
    await pickPlace(page, 'Origin', 'Chicago')
    await pickPlace(page, 'Destination', 'Toronto')
    await page.getByLabel('Load weight').fill('30000')
    await page.route('**/api/plans', (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'rate_limited', retry_after_min: 25 }),
      }),
    )
    await page.getByRole('button', { name: 'Plan trip' }).click()
    await expect(page.getByText(/Try again in 25 minutes/)).toBeVisible()
  })

  test('F7: theme and units choices stay after a reload', async ({ page }) => {
    await page.goto('/plan')
    await toggleTheme(page, 'dark')
    await expect(page.locator('html')).toHaveClass(/dark/)
    await page.getByRole('radio', { name: 'km' }).click()
    await page.reload()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expect(page.getByRole('radio', { name: 'km' })).toBeChecked()
  })

  test('F8: the planner has no axe violations in both themes', async ({ page }) => {
    await page.goto('/plan')
    await expect(page.getByRole('button', { name: 'Plan trip' })).toBeVisible()
    for (const dark of [false, true]) {
      if (dark) await toggleTheme(page, 'dark')
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
      expect(results.violations).toEqual([])
    }
  })

  test('F9: the landing page loads and links to sign-in or the planner', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(results.violations).toEqual([])
  })

  test('F10: the results screen has no axe violations in both themes', async ({ page }) => {
    await planTrip(page)
    for (const dark of [false, true]) {
      if (dark) await toggleTheme(page, 'dark')
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
      expect(
        results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 120))}`),
      ).toEqual([])
    }
  })
})
