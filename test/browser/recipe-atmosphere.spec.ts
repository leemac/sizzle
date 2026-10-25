import { expect, test, type Page } from '@playwright/test'

const recipe = {
  id: 9100,
  title: 'Weeknight chickpea curry',
  description: 'A warm, fragrant curry with chickpeas, vegetables and a squeeze of lime.',
  cuisine: 'Indian',
  course: 'main',
  total_minutes: 20,
  source_host: 'example.com',
  favorite: false,
  image_url: '/preview-recipe.webp' as string | null,
  hero_url: '/preview-recipe.webp' as string | null,
  photo_urls: [],
  author: 'Sizzle sample kitchen',
  source_url: 'https://example.com/curry',
  source_name: 'Sample kitchen',
  servings: 2,
  yield_text: null,
  prep_minutes: 10,
  cook_minutes: 10,
  main_ingredient: 'chickpeas',
  diets: ['vegan'],
  tags: [],
  tips: [],
  notes: null,
  rating: null,
  archived: false,
  created_at: '2026-10-24T12:00:00Z',
  edited_at: null,
  cooks_count: 0,
  last_cook: null,
  ingredients: [
    { section: null, quantity: 1, quantity_max: null, unit: 'cup', item: 'chickpeas', preparation: null, note: null },
  ],
  steps: [{ section: null, text: 'Simmer the chickpeas and vegetables until tender.' }],
}

async function recipeFixture(page: Page) {
  await page.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === 'http://sizzle.test:3211') return route.continue()
    return route.abort()
  })
  await page.goto('/')
  const data = JSON.parse((await page.locator('script[data-page="app"]').textContent())!)
  Object.assign(data.props, {
    recipes: [recipe],
    total_count: 1,
    page: 1,
    has_more: false,
    filters: {},
    pending_imports: [],
    failed_imports: [],
  })
  data.flash = { notice: 'Recipe preview ready' }
  const detail = {
    ...data,
    component: 'recipes/show',
    url: '/recipes/9100',
    props: { ...data.props, recipe: { ...recipe } },
    flash: {},
  }
  await page.route('**/*', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === '/preview-recipe.webp')
      return route.fulfill({ path: 'db/seeds/images/curry.webp', contentType: 'image/webp' })
    if (path === '/missing-recipe.webp') return route.fulfill({ status: 404, body: '' })
    if (request.headers()['x-inertia'] && (path === '/' || path === '/recipes/9100')) {
      return route.fulfill({ json: path === '/' ? data : detail, headers: { 'X-Inertia': 'true' } })
    }
    return route.fallback()
  })
  await page.getByRole('link', { name: 'Sizzle', exact: true }).click()
  await expect(page.getByText('Recipe preview ready', { exact: true })).toBeVisible()
  await page.locator('a[href="/recipes/9100"]').click()
  await expect(page.getByRole('heading', { name: recipe.title, exact: true })).toBeVisible()
  return detail
}

for (const width of [390, 1280]) {
  test(`the dark recipe hero uses its photo as a decorative color wash at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ colorScheme: 'light' })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await recipeFixture(page)
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
    const atmosphere = page.locator('.recipe-atmosphere')
    await expect(atmosphere).toHaveAttribute('data-ready', 'true')
    await expect(atmosphere).toHaveCSS('opacity', '1')
    await expect(atmosphere).toHaveCSS('pointer-events', 'none')
    await expect(atmosphere).toHaveAttribute('aria-hidden', 'true')
    await expect(page.getByRole('img', { name: recipe.title, exact: true })).toHaveCount(1)
    const favorite = page.getByRole('button', { name: 'Add to favorites', exact: true })
    await page.getByRole('link', { name: 'Edit recipe', exact: true }).first().focus()
    await page.keyboard.press('Tab')
    await expect(favorite).toBeFocused()
    expect(await favorite.evaluate((button) => getComputedStyle(button).outlineStyle)).toBe('solid')
    await favorite.blur()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: testInfo.outputPath(`recipe-atmosphere-${width}.png`), fullPage: true })
    expect(errors).toEqual([])
  })

  test(`missing photos retain a neutral readable hero at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const detail = await recipeFixture(page)
    expect(
      await page
        .locator('.recipe-atmosphere')
        .evaluate((element) => parseFloat(getComputedStyle(element).transitionDuration)),
    ).toBeLessThanOrEqual(0.00001)
    detail.props.recipe.hero_url = '/missing-recipe.webp'
    detail.props.recipe.image_url = '/missing-recipe.webp'
    await page.getByRole('link', { name: 'Sizzle', exact: true }).click()
    await page.locator('a[href="/recipes/9100"]').click()
    await expect(page.locator('.recipe-atmosphere')).toHaveAttribute('data-ready', 'false')
    await expect(page.locator('.recipe-atmosphere')).toHaveCSS('opacity', '0')
    detail.props.recipe.hero_url = null
    await page.getByRole('link', { name: 'Sizzle', exact: true }).click()
    await page.locator('a[href="/recipes/9100"]').click()
    await expect(page.locator('.recipe-atmosphere')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: recipe.title, exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
