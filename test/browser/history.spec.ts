import { expect, test } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  // Test traffic stays on this local Rails server, including fonts and assets.
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === 'http://sizzle.test:3211') return route.continue()
    return route.abort()
  })
})

for (const width of [390, 1280]) {
  test(`history navigation works on insecure LAN HTTP at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    expect(await page.evaluate(() => window.isSecureContext)).toBe(false)
    expect(await page.evaluate(() => typeof crypto.subtle)).toBe('undefined')
    await expect(page.getByRole('link', { name: 'Add recipe', exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Add recipe', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Add a recipe', exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Share straight from your phone instead' }).click()
    await expect(page.getByRole('heading', { name: 'Build the Shortcut' })).toBeVisible()
    await expect(page.locator('ol code', { hasText: /^text$/ })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`share-${width}.png`), fullPage: true })

    await page.goBack()
    await expect(page.getByRole('heading', { name: 'Add a recipe', exact: true })).toBeVisible()
    await page.goForward()
    await expect(page.getByRole('heading', { name: 'Build the Shortcut' })).toBeVisible()
    expect(errors).toEqual([])
  })
}
