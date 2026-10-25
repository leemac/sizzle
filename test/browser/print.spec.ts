import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === 'http://sizzle.test:3211') return route.continue()
    return route.abort()
  })
})

async function createRecipe(page: Page, title: string, ingredients: string[], steps: string[]) {
  await page.goto('/imports?mode=manual')
  await page.getByLabel('Recipe title', { exact: true }).fill(title)
  await page.getByLabel('Description (optional)', { exact: true }).fill('Bright, quick and good any night.')
  await page.getByLabel('Servings', { exact: true }).fill('4')
  await page.getByLabel('Prep (min)', { exact: true }).fill('15')
  await page.getByLabel('Cook (min)', { exact: true }).fill('40')
  await page.getByLabel('Ingredients', { exact: true }).fill(ingredients.join('\n'))
  await page.getByLabel('Method', { exact: true }).fill(steps.join('\n'))
  await page.getByRole('button', { name: 'Save recipe', exact: true }).click()
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
}

const pageCount = (pdf: Uint8Array) => new TextDecoder('latin1').decode(pdf).match(/\/Type\s*\/Page\b/g)?.length ?? 0

test('the print button opens the browser print dialog with the sheet ready', async ({ page }) => {
  await page.addInitScript(() => {
    window.print = () => {
      window.dispatchEvent(new Event('beforeprint'))
      document.body.dataset.printed = 'true'
    }
  })
  await page.setViewportSize({ width: 390, height: 900 })
  await createRecipe(page, 'Print button soup', ['1 cup lentils', '1 onion'], ['Simmer everything.'])

  const sheet = page.getByTestId('print-sheet')
  await expect(sheet).toHaveCount(0)
  await page.getByRole('button', { name: 'Print recipe', exact: true }).click()
  await expect(page.locator('body')).toHaveAttribute('data-printed', 'true')
  await expect(sheet).toContainText('Print button soup')
  await expect(sheet).toContainText('1 cup lentils')
  await expect(sheet).toContainText('Simmer everything.')
  await expect(sheet).toHaveAttribute('data-fit', 'page')

  // The sheet goes away again once printing is over.
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  await expect(sheet).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('imported text with one enormous word still wraps inside the paper', async ({ page }) => {
  await createRecipe(page, 'Unbroken stew', ['1 onion', 'y'.repeat(300)], ['Simmer everything.', 'x'.repeat(400)])
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')))
  const sheet = page.getByTestId('print-sheet')
  await expect(sheet).toHaveAttribute('data-fit', 'page')
  expect(await sheet.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
})

// A long ingredient list switches to the stacked layout rather than shrinking the type further.
for (const [name, ingredients, steps, layout] of [
  ['short', 4, 3, 'split'],
  ['long', 30, 18, 'stacked'],
] as const) {
  test(`a ${name} recipe prints on one page of Letter and A4`, async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width: 1280, height: 900 })
    await createRecipe(
      page,
      `Roast tomato and white bean stew ${name}`,
      Array.from({ length: ingredients }, (_, i) => `${i + 1} tbsp ingredient number ${i + 1}, finely chopped`),
      Array.from(
        { length: steps },
        (_, i) => `Step ${i + 1}: stir the pot over a medium heat until everything is glossy and fragrant, then taste.`,
      ),
    )

    for (const format of ['Letter', 'A4'] as const) {
      // Chromium fires beforeprint and afterprint around page.pdf, as it does for the print dialog.
      const pdf = await page.pdf({ format, path: testInfo.outputPath(`print-${name}-${format}.pdf`) })
      expect(pageCount(pdf), `${format} pages`).toBe(1)
    }

    await page.emulateMedia({ media: 'print' })
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')))
    const sheet = page.getByTestId('print-sheet')
    await expect(sheet).toHaveAttribute('data-fit', 'page')
    await expect(sheet).toHaveAttribute('data-layout', layout)
    await expect(page.locator('#app')).toBeHidden()
    await page.screenshot({ path: testInfo.outputPath(`print-${name}.png`), fullPage: true })
    expect(errors).toEqual([])
  })
}
