import { expect, test } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === 'http://sizzle.test:3211') return route.continue()
    return route.abort()
  })
})

for (const width of [390, 1280]) {
  test(`the wordmark stays accessible with a dark default under either system theme at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/')
    const logo = page.getByRole('link', { name: 'Sizzle', exact: true })
    await expect(logo).toHaveText('Sizzle')
    const particles = logo.locator('rect')
    await expect(particles).toHaveCount(60)
    const icon = logo.locator('img')
    await expect(icon).toHaveAttribute('src', '/icon.svg')
    await expect(icon).toHaveAttribute('alt', '')
    expect(await icon.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
    const positions = () => particles.evaluateAll((pixels) => pixels.map((pixel) => pixel.getAttribute('y')))
    const initial = await positions()
    await expect.poll(positions).not.toEqual(initial)

    await page.emulateMedia({ reducedMotion: 'reduce' })
    // Wait for the media query change event, then verify the field holds still.
    await page.waitForTimeout(100)
    const frozen = await positions()
    await page.waitForTimeout(150)
    expect(await positions()).toEqual(frozen)

    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      await page.evaluate(() => document.fonts.ready)
      await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
      await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(20, 20, 22)')
      await expect(particles.first()).toHaveCSS('fill', 'rgb(242, 242, 238)')
      await logo.focus()
      await expect(logo).toBeFocused()
      expect(await logo.evaluate((link) => getComputedStyle(link).outlineStyle)).toBe('solid')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath(`logo-${colorScheme}-${width}.png`), fullPage: true })
    }

    await page.getByRole('link', { name: 'Add recipe', exact: true }).click()
    await logo.click()
    await expect(page).toHaveURL('http://sizzle.test:3211/')
    expect(errors).toEqual([])
  })
}
