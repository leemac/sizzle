import { expect, test, type Page } from '@playwright/test'

// The radios are visually hidden inside their cards, so click the card like a person would.
const choose = (page: Page, name: RegExp) =>
  page
    .locator('label')
    .filter({ has: page.getByRole('radio', { name }) })
    .click()

const token = (name: string) => (page: Page) =>
  page.evaluate((property) => getComputedStyle(document.documentElement).getPropertyValue(property).trim(), name)

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === 'http://sizzle.test:3211') return route.continue()
    return route.abort()
  })
})

for (const width of [390, 1280]) {
  test(`make, use, edit and delete a custom theme at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ colorScheme: 'light' })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    // Browser tests share one database, so give each run its own name.
    const name = `Midnight snack ${width} ${Date.now()}`

    await page.goto('/appearance')
    await choose(page, /^Pesto/)
    await choose(page, /Light/)
    // Saving a new theme keeps this browser's mode, so save light first (Sizzle starts in dark).
    await page.getByRole('button', { name: 'Save appearance', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Appearance saved.')
    await page.getByRole('link', { name: 'Customize Pesto', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'New theme', exact: true })).toBeVisible()
    await expect(page.getByText('Starting from Pesto.')).toBeVisible()
    await page.getByLabel('Name', { exact: true }).fill(name)
    await expect(page.getByText('Everything is easy to read in light.')).toBeVisible()

    // A faint button label shows up as a readability warning straight away.
    await page.getByLabel('Button label hex').first().fill('#2a7a52')
    await expect(page.getByText('Button label', { exact: true }).last()).toBeVisible()
    await expect(page.getByText(/is hard to read/)).toBeVisible()
    await page.getByLabel('Button label hex').first().fill('#ffffff')
    await page.locator('#light-action').fill('#5b2a86')
    await expect(page.getByText('Everything is easy to read in light.')).toBeVisible()

    await page.getByRole('tab', { name: 'Dark colours' }).click()
    await page.locator('#dark-action').fill('#c9a6ff')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`theme-editor-${width}.png`), fullPage: true })

    await page.getByRole('button', { name: 'Save and use theme', exact: true }).click()
    await expect(page.getByRole('status')).toContainText(`You're using “${name}” now.`)
    await expect(page.locator('html')).toHaveAttribute('data-theme', /^custom-\d+$/)
    await expect.poll(() => token('--color-action')(page)).toBe('#5b2a86')
    await expect(page.getByRole('radio', { name: new RegExp(name) })).toBeChecked()

    // It sticks across a reload and follows dark mode with its own dark colours.
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/appearance')
    await choose(page, /Dark/)
    await page.getByRole('button', { name: 'Save appearance', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Appearance saved.')
    await page.reload()
    expect(await token('--color-action')(page)).toBe('#c9a6ff')

    await page.getByRole('link', { name: `Edit ${name}`, exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Edit theme', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Delete theme', exact: true }).click()
    await page.getByRole('button', { name: 'Delete theme', exact: true }).click()
    await expect(page.getByRole('status')).toContainText(`Deleted “${name}”.`)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'sunny-side-up')
    await expect(page.getByRole('radio', { name: new RegExp(name) })).toHaveCount(0)
    expect(errors).toEqual([])
  })
}
