import { expect, test } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === 'http://sizzle.test:3211') return route.continue()
    return route.abort()
  })
})

for (const width of [390, 1280]) {
  test(`release notes are readable and remembered at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await page.getByRole('link', { name: "What's new — unread release notes", exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Release notes', level: 1 })).toBeVisible()
    expect(await page.getByRole('article').count()).toBeGreaterThanOrEqual(5)
    await expect(page.getByRole('heading', { name: 'Upgrade', exact: true }).first()).toBeVisible()
    const firstNotes = page.locator('summary').first()
    await firstNotes.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Upgrade', exact: true }).first()).not.toBeVisible()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Upgrade', exact: true }).first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByRole('link', { name: 'Back to the cookbook' }).click()
    await page.reload()
    await expect(page.getByRole('link', { name: "What's new", exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: /unread release notes/ })).toHaveCount(0)
    await page.getByRole('link', { name: 'Sizzle release notes', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Release notes', level: 1 })).toBeVisible()
  })
}
