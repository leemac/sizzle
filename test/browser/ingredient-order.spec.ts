import { expect, test } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === 'http://sizzle.test:3211') return route.continue()
    return route.abort()
  })
})

for (const width of [390, 1280]) {
  test(`group ingredients by type and back at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    const title = `Lemon kale salad ${width}`
    await page.goto('/imports?mode=manual')
    await page.getByLabel('Recipe title', { exact: true }).fill(title)
    await page
      .getByLabel('Ingredients', { exact: true })
      .fill(
        '# Dressing\n2 tbsp olive oil\n1 tbsp lemon juice\n# Salad\n4 cups curly kale\n¼ cup grated parmesan\nsalt\n2 tbsp dried hibiscus',
      )
    await page.getByLabel('Method', { exact: true }).fill('Whisk the dressing.\nToss everything together.')
    await page.getByRole('button', { name: 'Save recipe', exact: true }).click()
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()

    // Rows as a reader sees them: amount and item are separate columns once a line is parsed.
    const rowText = () =>
      page
        .locator('[data-ingredient-list] button')
        .evaluateAll((rows) => rows.map((row) => (row as HTMLElement).innerText.replace(/\s+/g, ' ').trim()))
    const headings = page.locator('[data-ingredient-list]').locator('xpath=preceding-sibling::h3')
    const recipeOrder = page.getByRole('button', { name: 'Recipe order', exact: true })
    const byType = page.getByRole('button', { name: 'By type', exact: true })

    await expect(recipeOrder).toHaveAttribute('aria-pressed', 'true')
    await expect(headings).toHaveText(['Dressing', 'Salad'])
    await expect(page.locator('[data-ingredient-icon="none"]')).toHaveCount(1)

    await byType.click()
    await expect(byType).toHaveAttribute('aria-pressed', 'true')
    await expect(headings).toHaveText([
      'Fruit and veg',
      'Dairy',
      'Herbs and spices',
      'Oils, sauces and liquids',
      'Other',
    ])
    await expect
      .poll(rowText)
      .toEqual([
        '1 tbsp lemon juice',
        '4 cups curly kale',
        '¼ cup grated parmesan',
        'salt',
        '2 tbsp olive oil',
        '2 tbsp dried hibiscus',
      ])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.locator('[data-ingredient-list]').first().scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath(`ingredient-order-${width}.jpg`), type: 'jpeg', quality: 85 })

    await page.reload()
    await expect(page.getByRole('button', { name: 'By type', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(headings.first()).toHaveText('Fruit and veg')

    await page.getByRole('button', { name: 'Recipe order', exact: true }).click()
    await expect(headings).toHaveText(['Dressing', 'Salad'])
    await expect.poll(async () => (await rowText())[0]).toBe('2 tbsp olive oil')
    expect(errors).toEqual([])
  })
}
