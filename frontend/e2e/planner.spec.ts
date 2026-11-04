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

/** The theme button sits in the top bar, between the units toggle and the account (Step-14b). */
async function toggleTheme(page: Page, to: 'dark' | 'light') {
  await page.getByRole('button', { name: `Switch to ${to} theme` }).click()
}

/** A click on the map canvas at a share of its width and height. */
async function clickMap(page: Page, x = 0.5, y = 0.5) {
  const box = await page.locator('.maplibregl-canvas').boundingBox()
  if (!box) throw new Error('no map canvas')
  await page.mouse.click(box.x + box.width * x, box.y + box.height * y)
}

const isPhone = (name: string) => name.startsWith('phone')

/** The pick prompt: "Click the map..." on desktop, "Tap the map..." on a phone. */
const pickPrompt = (page: Page, field: string) =>
  page.getByText(new RegExp(`(Click|Tap) the map to set your ${field}\\.`))

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

  test('F9: the guide (landing) page loads and links to the planner', async ({ page }) => {
    await page.goto('/guide')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(results.violations).toEqual([])
  })

  test('F14: Choose on map fills the origin from a clicked point (Step-14b)', async ({ page }) => {
    await page.goto('/plan')
    await page.locator('.maplibregl-canvas').waitFor()
    await page.getByRole('button', { name: 'Choose Origin on map' }).click()
    await expect(pickPrompt(page, 'Origin')).toBeVisible()
    // Above the lowered sheet on a phone, clear of the panel on desktop.
    await clickMap(page, 0.7, 0.3)
    // E2E mode replays the saved real Geoapify answer for a point in Joliet, IL.
    await expect(page.getByRole('combobox', { name: 'Origin', exact: true })).toHaveValue(
      /Joliet, IL 60432, USA/,
    )
    await expect(pickPrompt(page, 'Origin')).toHaveCount(0)
    await expect(page.getByText('Origin time (CST)')).toBeVisible()
  })

  test('F15: Esc cancels Choose on map and the info notes explain the settings', async ({
    page,
  }) => {
    await page.goto('/plan')
    await page.getByRole('button', { name: 'Choose Destination on map' }).click()
    await expect(pickPrompt(page, 'Destination')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(pickPrompt(page, 'Destination')).toHaveCount(0)
    await page.getByText(/More options/).click()
    // Radix closes a note when the sheet around it scrolls, and Playwright scrolls the sheet to
    // reach the button, so the button is brought into view first.
    const hos = page.getByRole('button', { name: 'What is HOS breaks?' })
    await hos.scrollIntoViewIfNeeded()
    await expect(async () => {
      await hos.click()
      await expect(page.getByRole('tooltip')).toContainText('Hours of Service', { timeout: 1000 })
    }).toPass()
  })

  test('F16: a click on empty map closes the open Checkpoint card (Step-14b)', async ({
    page,
  }, testInfo) => {
    await planTrip(page)
    await page.getByRole('tab', { name: 'Checkpoints' }).click()
    const row = page.getByRole('button', { name: /Checkpoint 2 ·/ })
    // Desktop opens a pop-up on the map; a phone shows the detail in the sheet.
    const card = isPhone(testInfo.project.name)
      ? page.getByRole('button', { name: 'Back to checkpoints' })
      : page.locator('.tp-popup')
    await row.click()
    await expect(card).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(card).toHaveCount(0)
    await row.click()
    await expect(card).toBeVisible()
    // A corner of the map, below the header and away from the routes and the card.
    await clickMap(page, 0.97, 0.15)
    await expect(card).toHaveCount(0)
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
