import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === 'http://sizzle.test:3211') return route.continue()
    return route.abort()
  })
})

async function saveRecipe(page: Page, title: string, source: string) {
  await page.goto('/imports?mode=manual')
  await page.getByLabel('Recipe title', { exact: true }).fill(title)
  await page.getByLabel('Source link (optional)', { exact: true }).fill(source)
  await page.getByLabel('Ingredients', { exact: true }).fill('1 cup rice')
  await page.getByLabel('Method', { exact: true }).fill('Simmer until tender.')
  await page.getByRole('button', { name: 'Save recipe', exact: true }).click()
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  return new URL(page.url()).pathname
}

for (const width of [390, 1280]) {
  test(`review saved, archived, pending and repeated links at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    const prefix = `https://example.com/duplicate-${width}-${Date.now()}`
    const savedPath = await saveRecipe(page, 'My saved rice', `${prefix}/rice`)
    const archivedPath = await saveRecipe(page, 'Archived soup', `${prefix}/soup`)
    await page.getByRole('button', { name: 'Archive recipe', exact: true }).click()
    await expect(page.getByText('Archived “Archived soup”.')).toBeVisible()

    await page.goto('/imports')
    const input = page.locator('#input')
    await input.fill(`${prefix}/pending`)
    await page.getByRole('button', { name: 'Import', exact: true }).click()
    await expect(input).toHaveValue('')

    const links = `${prefix}/rice?utm_source=ig\n${prefix}/soup\n${prefix}/pending#recipe\n${prefix}/new\n${prefix}/new?utm_source=ig`
    await input.fill(links)
    await page.getByRole('button', { name: 'Import', exact: true }).click()
    const review = page.getByRole('region', { name: 'Review duplicate links' })
    await expect(review).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Review duplicate links' })).toBeFocused()
    await expect(input).toHaveValue(links)
    await expect(review.getByRole('link', { name: 'Open saved recipe' }).first()).toHaveAttribute('href', savedPath)
    await expect(review.getByRole('link', { name: 'Edit saved recipe' }).first()).toHaveAttribute(
      'href',
      `${savedPath}/edit`,
    )
    await expect(review.getByText('Already importing · Will be skipped', { exact: true })).toBeVisible()
    await expect(review.getByText('New link · Included 2 times', { exact: true })).toBeVisible()
    const restore = review.getByRole('checkbox', { name: /Restore to cookbook/ })
    const importOnce = review.getByRole('checkbox', { name: /Import once/ })
    await expect(restore).not.toBeChecked()
    await expect(importOnce).toBeChecked()
    await importOnce.uncheck()
    await expect(review.getByRole('button', { name: 'Done — skip these links' })).toBeVisible()
    await importOnce.check()
    await restore.check()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: testInfo.outputPath(`duplicate-review-${width}.png`), fullPage: true })

    await review.getByRole('button', { name: 'Import 1 new recipe and restore 1 archived', exact: true }).click()
    await expect(review).not.toBeVisible()
    await expect(input).toHaveValue('')
    await expect(
      page.getByText('Restored 1 archived recipe to your cookbook.', {
        exact: true,
      }),
    ).toBeVisible()
    // The original pending link and one new import; saved sources did not enqueue.
    await expect(page.locator('li').filter({ hasText: prefix })).toHaveCount(2)

    await page.goto(archivedPath)
    await expect(page.getByText("This recipe is archived. It's hidden from your recipes and search.")).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'Archive recipe', exact: true })).toBeVisible()
    expect(errors).toEqual([])
  })
}

test('a single saved link can be opened, edited or skipped, and back preserves the paste', async ({ page }) => {
  const source = `https://example.com/single-duplicate-${Date.now()}`
  const savedPath = await saveRecipe(page, 'Saved beans', source)
  await page.goto('/imports')
  await page.locator('#input').fill(source)
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  const review = page.getByRole('region', { name: 'Review duplicate links' })
  await expect(review.getByRole('link', { name: 'Open saved recipe' })).toHaveAttribute('href', savedPath)
  await expect(review.getByRole('link', { name: 'Edit saved recipe' })).toHaveAttribute('href', `${savedPath}/edit`)
  await review.getByRole('button', { name: 'Back to links' }).click()
  await expect(page.locator('#input')).toBeFocused()
  await expect(page.locator('#input')).toHaveValue(source)
  await expect(review).not.toBeVisible()
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await review.getByRole('button', { name: 'Done — skip these links' }).click()
  await expect(page.locator('#input')).toHaveValue('')
  await expect(page.getByText('Done. No new imports were needed.', { exact: true })).toBeVisible()
})

test('manual duplicate choices preserve fields and allow a version without the source link', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 900 })
  const source = `https://example.com/manual-duplicate-${Date.now()}`
  const savedPath = await saveRecipe(page, 'Original rice', source)
  await page.goto('/imports?mode=manual')
  await page.getByLabel('Recipe title', { exact: true }).fill('My rice variation')
  await page.getByLabel('Source link (optional)', { exact: true }).fill(`${source}?utm_source=ig`)
  await page.getByLabel('Ingredients', { exact: true }).fill('2 cups rice')
  await page.getByLabel('Method', { exact: true }).fill('Steam until tender.')
  await page.getByRole('button', { name: 'Save recipe', exact: true }).click()
  const choices = page.getByRole('region', { name: 'Saved recipe', exact: true })
  await expect(choices).toContainText('Original rice')
  await expect(choices.getByRole('link', { name: 'Open saved recipe' })).toHaveAttribute('href', savedPath)
  await expect(choices.getByRole('link', { name: 'Edit saved recipe' })).toHaveAttribute('href', `${savedPath}/edit`)
  await expect(page.getByLabel('Recipe title', { exact: true })).toHaveValue('My rice variation')
  await page.screenshot({ path: testInfo.outputPath('manual-duplicate-390.png'), fullPage: true })
  await choices.getByRole('button', { name: 'Remove source link' }).click()
  await expect(page.getByLabel('Source link (optional)', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Ingredients', { exact: true })).toHaveValue('2 cups rice')
  await page.getByRole('button', { name: 'Save recipe', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'My rice variation', exact: true })).toBeVisible()
})
