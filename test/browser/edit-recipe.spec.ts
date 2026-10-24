import { expect, test } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === 'http://sizzle.test:3211') return route.continue()
    return route.abort()
  })
})

for (const width of [390, 1280]) {
  test(`edit and archive a recipe at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    const title = `Lentil soup ${width}`
    const edited = `Smoky lentil soup ${width}`

    await page.goto('/imports?mode=manual')
    await page.getByLabel('Recipe title', { exact: true }).fill(title)
    await page.getByLabel('Ingredients', { exact: true }).fill('1 cup lentils\n1 onion')
    await page.getByLabel('Method', { exact: true }).fill('Simmer everything.')
    await page.getByRole('button', { name: 'Save recipe', exact: true }).click()
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()

    await page.getByRole('link', { name: 'Edit recipe', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'Edit recipe', exact: true })).toBeVisible()
    await expect(page.getByLabel('Recipe title', { exact: true })).toHaveValue(title)
    await page.getByLabel('Recipe title', { exact: true }).fill(edited)
    await page.getByLabel('Ingredients', { exact: true }).fill('# Soup\n1 cup lentils\n1 onion\n1 tsp smoked paprika')
    await page.getByLabel('Course (optional)', { exact: true }).selectOption('soup')
    await page.getByLabel('Your notes (optional)', { exact: true }).fill('Double the paprika next time.')
    await page.getByLabel('Method', { exact: true }).fill('# Method')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`edit-form-${width}.png`), fullPage: true })

    // A validation error keeps everything typed so far.
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('needs at least one step')
    await expect(page.getByLabel('Recipe title', { exact: true })).toHaveValue(edited)
    await page.getByLabel('Method', { exact: true }).fill('Simmer everything.\nStir in the paprika.')
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()

    await expect(page.getByRole('heading', { name: edited, exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Soup', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '1 tsp smoked paprika', exact: true })).toBeVisible()
    await expect(page.getByText('Double the paprika next time.', { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`edited-recipe-${width}.png`), fullPage: true })

    await page.getByRole('button', { name: 'Archive recipe', exact: true }).click()
    await expect(page.getByText(`Archived “${edited}”.`)).toBeVisible()
    await expect(page.getByRole('link', { name: edited })).toHaveCount(0)
    expect(errors).toEqual([])
  })
}
