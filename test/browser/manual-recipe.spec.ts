import { expect, test } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === 'http://sizzle.test:3211') return route.continue()
    return route.abort()
  })
})

for (const width of [390, 1280]) {
  test(`write, browse and delete a recipe without AI at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    const title = `Manual coconut rice ${width}`

    await page.goto('/imports?mode=manual')
    await page.getByLabel('Recipe title', { exact: true }).fill(title)
    await page.getByLabel('Description (optional)', { exact: true }).fill('A family recipe, saved without AI.')
    await page.getByLabel('Source link (optional)', { exact: true }).fill(`https://example.com/coconut-rice-${width}`)
    await page.getByLabel('Servings', { exact: true }).fill('4')
    await page.getByLabel('Prep (min)', { exact: true }).fill('5')
    await page.getByLabel('Cook (min)', { exact: true }).fill('20')
    await page.getByLabel('Ingredients', { exact: true }).fill('1 cup rice\n1 cup coconut milk')
    await page.getByLabel('Method', { exact: true }).fill('Rinse the rice.\nSimmer for 20 minutes.')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`manual-form-${width}.png`), fullPage: true })
    await page.getByRole('button', { name: 'Save recipe', exact: true }).click()

    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
    await expect(page.getByRole('button', { name: '1 cup rice', exact: true })).toBeVisible()
    await expect(page.getByText('Simmer for 20 minutes.', { exact: true })).toBeVisible()
    await expect(page.getByText('25 min', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'example.com' })).toHaveAttribute(
      'href',
      `https://example.com/coconut-rice-${width}`,
    )
    await page.screenshot({ path: testInfo.outputPath(`manual-recipe-${width}.png`), fullPage: true })
    await page.getByRole('link', { name: 'All recipes', exact: true }).click()
    await expect(page.getByRole('link', { name: title })).toBeVisible()
    await page.getByRole('link', { name: title }).click()
    await page.getByRole('button', { name: 'Delete recipe', exact: true }).click()
    await page.getByRole('button', { name: 'Delete recipe', exact: true }).click()
    await expect(page.getByRole('link', { name: title })).toHaveCount(0)
    expect(errors).toEqual([])
  })
}
