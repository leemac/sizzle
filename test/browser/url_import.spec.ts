import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === 'http://sizzle.test:3211') return route.continue()
    return route.abort()
  })
})

// An import shared from a phone, still being read.
const sharedImport = {
  id: 101,
  kind: 'url',
  origin: 'share',
  url: 'https://example.com/curry',
  text_preview: null,
  status: 'fetching',
  error: null,
  recipe_id: null,
  recipe_title: null,
  created_at: new Date().toISOString(),
}

async function galleryFixture(page: Page, props: Record<string, unknown> = {}) {
  await page.goto('/')
  const data = JSON.parse((await page.locator('script[data-page="app"]').textContent())!)
  Object.assign(data.props, {
    recipes: [],
    total_count: 0,
    page: 1,
    has_more: false,
    filters: {},
    pending_imports: [],
    failed_imports: [],
    facets: {
      courses: ['drink', 'main', 'baking', 'breakfast', 'bread', 'dessert', 'salad', 'side', 'soup'].map((value) => ({
        value,
        count: 1,
      })),
      cuisines: [{ value: 'Indian', count: 1 }],
      main_ingredients: [{ value: 'chickpeas', count: 1 }],
      diets: [{ value: 'vegan', count: 1 }],
      max_minutes: [30, 60, 120],
    },
    app: { claude_configured: true },
    ...props,
  })
  data.flash = { notice: 'Ready' }
  // Exercise real Inertia visits and polling with local protocol responses.
  // Controller tests cover enqueueing and the pipeline with HTTP/DNS/Claude doubles.
  await page.route('**/*', async (route) => {
    const request = route.request()
    if (new URL(request.url()).pathname === '/' && request.headers()['x-inertia']) {
      return route.fulfill({ json: data, headers: { 'X-Inertia': 'true' } })
    }
    return route.fallback()
  })
  await page.getByRole('link', { name: 'Sizzle', exact: true }).click()
  await expect(page.getByText('Ready', { exact: true })).toBeVisible()
  return data
}

for (const width of [390, 1280]) {
  test(`an empty cookbook offers a few ways to start at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await galleryFixture(page)

    await expect(page.getByText('No recipes yet.', { exact: true })).toBeVisible()
    await expect(page.getByRole('textbox')).toHaveCount(0)
    await expect(page.getByRole('link', { name: /Import a link/ })).toHaveAttribute('href', '/imports')
    await expect(page.getByRole('link', { name: /Write a recipe/ })).toHaveAttribute('href', '/imports?mode=manual')
    await expect(page.getByRole('link', { name: /Share from your phone.*Save as you browse/ })).toHaveAttribute(
      'href',
      '/share',
    )
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`empty-${width}.png`), fullPage: true })

    await page.getByRole('link', { name: /Import a link/ }).click()
    await expect(page.getByRole('heading', { name: 'Add a recipe', exact: true })).toBeVisible()
  })

  test(`shared imports show on the gallery and polling adds the recipe at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    const data = await galleryFixture(page, { pending_imports: [sharedImport] })

    await expect(page.getByText('Reading the page', { exact: true })).toBeVisible()
    await expect(page.getByText('No recipes yet.', { exact: true })).not.toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`import-pending-${width}.png`), fullPage: true })

    data.props.pending_imports = []
    data.props.total_count = 1
    data.props.recipes = [
      {
        id: 102,
        title: 'Chickpea curry',
        cuisine: 'Indian',
        course: 'main',
        total_minutes: 30,
        source_host: 'example.com',
        image_url: null,
      },
    ]
    await expect(page.getByRole('heading', { name: 'Chickpea curry', exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Reading the page', { exact: true })).not.toBeVisible()
    await expect(page.getByText('1 recipe', { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`import-saved-${width}.png`), fullPage: true })
    expect(errors).toEqual([])
  })
}

test('background failures stay visible on the gallery', async ({ page }) => {
  const data = await galleryFixture(page, { pending_imports: [sharedImport] })
  await expect(page.getByText('Reading the page', { exact: true })).toBeVisible()

  data.props.pending_imports = []
  data.props.failed_imports = [{ ...sharedImport, status: 'failed', error: "That doesn't look like a recipe." }]
  await expect(page.getByRole('region', { name: 'Failed imports' })).toContainText("That doesn't look like a recipe.", {
    timeout: 10_000,
  })
  await expect(page.getByRole('link', { name: 'View imports and retry' })).toHaveAttribute('href', '/imports')
})

test('links are imported from the Add recipe page, and server errors keep the link', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Add recipe', exact: true }).click()
  const input = page.getByRole('textbox', { name: /^Recipe link/ })
  await input.fill('https://example.com:6379/pie')
  await page.getByRole('button', { name: 'Import', exact: true }).click()

  await expect(page.locator('#input-error')).toContainText('port 6379 is not allowed')
  await expect(input).toHaveValue('https://example.com:6379/pie')
  await expect(page).toHaveURL('/imports')
})
