import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { BrowserContext, Page } from '@playwright/test'

/** Sign in through the E2E_MODE test endpoint; the session cookie lands in the context. */
async function signIn(context: BrowserContext) {
  const csrf = await context.request.get('/api/csrf')
  const { csrf_token } = await csrf.json()
  const res = await context.request.post('/api/test/sign-in', {
    headers: { 'X-CSRFToken': csrf_token },
  })
  expect(res.ok()).toBeTruthy()
}

const openAccountMenu = (page: Page) => page.getByRole('button', { name: 'Account menu' }).click()

test.describe('access flows', () => {
  test('F1: a signed-out visitor to / sees the planner under a sign-in pop-up', async ({
    page,
  }) => {
    await page.goto('/')
    const dialog = page.getByRole('dialog', { name: 'Sign in to plan your trip' })
    await expect(dialog).toBeVisible()
    await expect(page.getByText('Your session ended')).toHaveCount(0)
    // The modal hides the page from assistive tech, so the map is found with includeHidden.
    await expect(
      page.getByRole('application', { name: 'Route map', includeHidden: true }),
    ).toBeAttached()
    await expect(page.locator('.maplibregl-canvas')).toBeAttached()
    // The pop-up cannot be closed.
    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Close' })).toHaveCount(0)
  })

  test('F1: the sign-in pop-up has no axe violations', async ({ page }) => {
    await page.goto('/plan')
    await expect(page.getByRole('dialog', { name: 'Sign in to plan your trip' })).toBeVisible()
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(results.violations).toEqual([])
  })

  test('F1: a signed-in visitor to / gets the planner with no pop-up', async ({
    page,
    context,
  }) => {
    await signIn(context)
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('the header link swaps between the planner and the guide', async ({ page }) => {
    await page.goto('/guide')
    await page.getByRole('banner').getByRole('link', { name: 'Try TruckPilot' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('link', { name: 'See how it works' }).first()).toHaveAttribute(
      'href',
      '/guide',
    )
  })

  test('F11: sign out shows the toast and the sign-in pop-up', async ({ page, context }) => {
    await signIn(context)
    await page.goto('/plan')
    await openAccountMenu(page)
    await page.getByRole('menuitem', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByText('Signed out', { exact: true })).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Sign in to plan your trip' })).toBeVisible()
  })

  test('F12: a 401 mid-use reopens the sign-in pop-up with the session-ended message', async ({
    page,
    context,
  }) => {
    await signIn(context)
    await page.goto('/plan')
    await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible()
    await context.clearCookies()
    // The next call that needs the session answers 401: a place search.
    await page.getByLabel('Origin', { exact: true }).fill('Chicago')
    await expect(page).toHaveURL(/\/plan\?ended=1$/)
    await expect(page.getByRole('dialog', { name: 'Sign in to plan your trip' })).toBeVisible()
    await expect(page.getByText('Your session ended. Sign in again.')).toBeVisible()
  })

  test('F13: Esc cancels the delete dialog, confirming deletes the account', async ({
    page,
    context,
  }) => {
    await signIn(context)
    await page.goto('/plan')
    await openAccountMenu(page)
    await page.getByRole('menuitem', { name: 'Delete my account' }).click()
    await expect(page.getByRole('dialog', { name: 'Delete your account?' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await openAccountMenu(page)
    await page.getByRole('menuitem', { name: 'Delete my account' }).click()
    await page.getByRole('button', { name: 'Delete account' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByText('Account deleted', { exact: true })).toBeVisible()
  })
})
