import { expect, test, type Page } from '@playwright/test'

async function deleteRecipe(page: Page, title: string) {
  await page.getByRole('button', { name: 'Delete recipe', exact: true }).click()
  await page.getByRole('button', { name: 'Delete recipe', exact: true }).click()
  await expect(page.getByRole('link', { name: title })).toHaveCount(0)
}

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
    await page.getByRole('button', { name: 'Add to favorites', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Favorited', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await page.screenshot({ path: testInfo.outputPath(`favorited-recipe-${width}.png`) })
    await page.getByRole('link', { name: 'All recipes', exact: true }).click()
    await expect(page.getByRole('link', { name: title })).toBeVisible()
    await page.getByRole('button', { name: 'Favorites', exact: true }).click()
    await expect(page).toHaveURL(/favorites=1/)
    await expect(page.getByRole('link', { name: title })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`favorites-gallery-${width}.png`), fullPage: true })
    await page.getByRole('link', { name: title }).click()
    await deleteRecipe(page, title)

    // The smallest valid recipe must also work with every optional field blank.
    await page.goto('/imports?mode=manual')
    const minimalTitle = `Minimal sauce ${width}`
    await page.getByLabel('Recipe title', { exact: true }).fill(minimalTitle)
    await page.getByLabel('Ingredients', { exact: true }).fill('# Sauce')
    await page.getByLabel('Method', { exact: true }).fill('Stir and serve.')
    await page.getByRole('button', { name: 'Save recipe', exact: true }).click()
    await expect(page.getByText('needs at least one ingredient, not only headings', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Recipe title', { exact: true })).toHaveValue(minimalTitle)
    await expect(page.getByLabel('Method', { exact: true })).toHaveValue('Stir and serve.')
    await page.getByLabel('Ingredients', { exact: true }).fill('# Sauce\n1 cup yogurt')
    await page.getByRole('button', { name: 'Save recipe', exact: true }).click()
    await expect(page.getByRole('heading', { name: minimalTitle, exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Sauce', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '1 cup yogurt', exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: minimalTitle, exact: true })).toBeVisible()
    await deleteRecipe(page, minimalTitle)
    expect(errors).toEqual([])
  })
}
