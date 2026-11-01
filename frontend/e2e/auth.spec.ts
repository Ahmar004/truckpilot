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
  test('F1: a signed-out visitor to /plan lands on /sign-in with no message', async ({ page }) => {
    await page.goto('/plan')
    await expect(page).toHaveURL(/\/sign-in$/)
    await expect(page.getByRole('heading', { name: 'Sign in to plan your trip' })).toBeVisible()
    await expect(page.getByText('Your session ended')).toHaveCount(0)
  })

  test('F1: the sign-in page has no axe violations', async ({ page }) => {
    await page.goto('/sign-in')
    await expect(page.getByRole('heading', { name: 'Sign in to plan your trip' })).toBeVisible()
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(results.violations).toEqual([])
  })

  test('F1: a signed-in visitor on /sign-in is forwarded to /plan', async ({ page, context }) => {
    await signIn(context)
    await page.goto('/sign-in')
    await expect(page).toHaveURL(/\/plan$/)
  })

  test('F11: sign out shows the toast on the landing page', async ({ page, context }) => {
    await signIn(context)
    await page.goto('/plan')
    await openAccountMenu(page)
    await page.getByRole('menuitem', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByText('Signed out', { exact: true })).toBeVisible()
    await page.goto('/plan')
    await expect(page).toHaveURL(/\/sign-in$/)
  })

  test('F12: a 401 mid-use goes to /sign-in with the session-ended message', async ({
    page,
    context,
  }) => {
    await signIn(context)
    await page.goto('/plan')
    await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible()
    await context.clearCookies()
    // The next call that needs the session answers 401: a place search.
    await page.getByLabel('Origin', { exact: true }).fill('Chicago')
    await expect(page).toHaveURL(/\/sign-in\?ended=1$/)
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
