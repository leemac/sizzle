import { expect, test } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === 'http://sizzle.test:3211') return route.continue()
    return route.abort()
  })
})

for (const width of [390, 1280]) {
  test(`group ingredients and scale servings at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    const title = `Coconut curry with rice ${width}`
    await page.goto('/imports?mode=manual')
    await page.getByLabel('Recipe title', { exact: true }).fill(title)
    await page
      .getByLabel('Description (optional)')
      .fill('A weeknight curry with fragrant rice and a creamy coconut sauce.')
    await page.getByLabel('Servings', { exact: true }).fill('4')
    await page
      .getByLabel('Ingredients', { exact: true })
      .fill('# Rice\n1½ cups rice\n# Sauce\n1–2 tbsp curry paste\n1 (400 g) can coconut milk\n#\nsalt to taste')
    await page
      .getByLabel('Method', { exact: true })
      .fill('Cook the rice.\nSimmer the sauce for 20 minutes.\nServe together.')
    await page.getByRole('button', { name: 'Save recipe', exact: true }).click()
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Rice', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Sauce', exact: true })).toBeVisible()

    const servings = page.getByRole('spinbutton', { name: 'Servings', exact: true })
    await page.getByRole('button', { name: 'Half quantities', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(servings).toHaveValue('2')
    await expect(page.getByRole('button', { name: '¾ cup rice', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Original quantities', exact: true }).click()
    await page.getByRole('button', { name: '1½ cups rice', exact: true }).click()
    await servings.fill('8')
    await expect(page.getByRole('button', { name: '3 cups rice', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: '2–4 tbsp curry paste', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '2 (400 g) can coconut milk', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'salt to taste', exact: true })).toBeVisible()
    await expect(page.getByText('Simmer the sauce for 20 minutes.', { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
    await page.screenshot({
      path: testInfo.outputPath(`ingredient-groups-servings-${width}.jpg`),
      type: 'jpeg',
      quality: 85,
      fullPage: true,
    })
    await page.getByRole('button', { name: 'Add to favorites', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Favorited', exact: true })).toBeVisible()
    await expect(servings).toHaveValue('8')

    await servings.fill('0')
    await expect(servings).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText('Enter servings from ½ to 10,000, in half-serving increments.')).toBeVisible()
    await servings.fill('10001')
    await expect(servings).toHaveAttribute('aria-invalid', 'true')
    await servings.fill('10000')
    await expect(page.getByRole('button', { name: '3750 cups rice', exact: true })).toBeVisible()
    await servings.fill('2')
    await expect(page.getByRole('button', { name: '¾ cup rice', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Reset', exact: true }).click()
    await expect(servings).toHaveValue('4')
    await expect(page.getByRole('button', { name: '1½ cups rice', exact: true })).toBeVisible()
    await servings.fill('8')
    await page.reload()
    await expect(servings).toHaveValue('4')

    await page.getByRole('link', { name: 'Edit recipe', exact: true }).first().click()
    await expect(page.getByLabel('Ingredients', { exact: true })).toHaveValue(
      '# Rice\n1½ cups rice\n# Sauce\n1–2 tbsp curry paste\n1 (400 g) can coconut milk\n#\nsalt to taste',
    )
    await page.getByLabel('Servings', { exact: true }).fill('6')
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(servings).toHaveValue('6')
    await expect(page.getByRole('button', { name: '1½ cups rice', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Delete recipe', exact: true }).click()
    await page.getByRole('button', { name: 'Delete recipe', exact: true }).click()
    await expect(page.getByRole('link', { name: title, exact: true })).toHaveCount(0)
    expect(errors).toEqual([])
  })
}

test('multiplier controls work without a saved serving count', async ({ page }) => {
  await page.goto('/imports?mode=manual')
  await page.getByLabel('Recipe title', { exact: true }).fill('Sauce without servings')
  await page.getByLabel('Ingredients', { exact: true }).fill('1/2 cup milk\nsalt to taste')
  await page.getByLabel('Method', { exact: true }).fill('Heat gently.')
  await page.getByRole('button', { name: 'Save recipe', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Sauce without servings', exact: true })).toBeVisible()
  await expect(page.getByRole('spinbutton', { name: 'Servings', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Double quantities', exact: true }).click()
  await expect(page.getByRole('button', { name: '1 cup milk', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Half quantities', exact: true }).click()
  await expect(page.getByRole('button', { name: '¼ cup milk', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Original quantities', exact: true }).click()
  await expect(page.getByRole('button', { name: '1/2 cup milk', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Delete recipe', exact: true }).click()
  await page.getByRole('button', { name: 'Delete recipe', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Sauce without servings', exact: true })).toHaveCount(0)
})
