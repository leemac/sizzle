import { expect, test, type Page } from '@playwright/test'

// The radios are visually hidden inside their cards, so click the card like a person would.
const choose = (page: Page, name: RegExp) =>
  page
    .locator('label')
    .filter({ has: page.getByRole('radio', { name }) })
    .click()

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === 'http://sizzle.test:3211') return route.continue()
    return route.abort()
  })
})

const background = () => getComputedStyle(document.documentElement).getPropertyValue('--color-porcelain').trim()

for (const width of [390, 1280]) {
  test(`changing the theme and mode at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ colorScheme: 'light' })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')
    await page.getByRole('link', { name: 'Appearance', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Appearance', exact: true })).toBeVisible()
    await expect(page.getByRole('radio', { checked: true })).toHaveCount(0)

    // Choosing previews the whole page before saving.
    await choose(page, /Blue plate special/)
    await choose(page, /Light/)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'blue-plate-special')
    expect(await page.evaluate(background)).toBe('#f5f6f8')

    // Auto follows the device.
    await choose(page, /Auto/)
    await page.emulateMedia({ colorScheme: 'dark' })
    expect(await page.evaluate(background)).toBe('#10131a')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`appearance-${width}.png`), fullPage: true })

    // Leaving without saving puts the saved look back.
    await page.getByRole('link', { name: 'Sizzle', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'sunny-side-up')

    await page.getByRole('link', { name: 'Appearance', exact: true }).click()
    await choose(page, /Beet it/)
    await choose(page, /Dark/)
    await page.getByRole('button', { name: 'Save appearance', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Appearance saved.')

    // The choice survives a reload, and dark mode holds even on a light device.
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'beet-it')
    expect(await page.evaluate(background)).toBe('#151013')
    await page.screenshot({ path: testInfo.outputPath(`appearance-saved-${width}.png`), fullPage: true })
    expect(errors).toEqual([])
  })
}
