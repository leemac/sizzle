import { expect, test } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === 'http://sizzle.test:3211') return route.continue()
    return route.abort()
  })
})

for (const width of [390, 1280]) {
  test(`mark a recipe as made and see its stats at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    const title = `Weeknight dal ${width}`

    await page.goto('/imports?mode=manual')
    await page.getByLabel('Recipe title', { exact: true }).fill(title)
    await page.getByLabel('Ingredients', { exact: true }).fill('1 cup red lentils\n1 onion')
    await page.getByLabel('Method', { exact: true }).fill('Simmer everything.')
    await page
      .getByLabel('Source link (optional)', { exact: true })
      .fill(`https://example.com/dal-${width}-${Date.now()}`) // unique: source links can't repeat
    await page.getByRole('button', { name: 'Save recipe', exact: true }).click()
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()

    const details = page.getByRole('complementary', { name: 'Recipe details' })
    await expect(details.getByRole('link', { name: 'example.com' })).toBeVisible()
    await expect(details).toContainText('MadeNot yet')
    await expect(details).toContainText('AddedJust now')
    await expect(details).not.toContainText('Updated')

    await page.getByRole('button', { name: 'I made this', exact: true }).click()
    await expect(page.getByText('Made today', { exact: true })).toBeVisible()
    await expect(details).toContainText('MadeOnce')
    await expect(details).toContainText('Last madeToday')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`made-it-${width}.png`), fullPage: true })

    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(page.getByRole('button', { name: 'I made this', exact: true })).toBeVisible()
    await expect(details).toContainText('MadeNot yet')

    await page.getByRole('link', { name: 'Edit recipe', exact: true }).first().click()
    await page.getByLabel('Recipe title', { exact: true }).fill(`${title} with spinach`)
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(details).toContainText('UpdatedJust now')
    expect(errors).toEqual([])
  })
}
