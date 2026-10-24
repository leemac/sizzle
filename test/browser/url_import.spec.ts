import { expect, test, type Locator, type Page } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === 'http://sizzle.test:3211') return route.continue()
    return route.abort()
  })
})

async function paste(input: Locator, text: string) {
  const allowed = await input.evaluate((element, text) => {
    const clipboardData = new DataTransfer()
    clipboardData.setData('text/plain', text)
    return element.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }))
  }, text)
  // Synthetic paste events do not insert text. Emulate the default edit if allowed.
  if (allowed) await input.fill(text)
}

async function galleryFixture(page: Page) {
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
  })
  data.flash = { notice: 'Ready to import' }
  const requests: { url: string }[] = []
  const item = {
    id: 101,
    kind: 'url',
    origin: 'web',
    url: 'https://example.com/curry',
    text_preview: null,
    status: 'fetching',
    error: null,
    recipe_id: null,
    recipe_title: null,
    created_at: new Date().toISOString(),
  }
  // Exercise real Inertia forms and polling with local protocol responses.
  // Controller tests cover enqueueing and the pipeline with HTTP/DNS/Claude doubles.
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname === '/imports' && request.method() === 'POST') {
      requests.push(request.postDataJSON())
      data.props.pending_imports = [item]
      return route.fulfill({ json: data, headers: { 'X-Inertia': 'true' } })
    }
    if (url.pathname === '/' && request.headers()['x-inertia']) {
      return route.fulfill({ json: data, headers: { 'X-Inertia': 'true' } })
    }
    return route.fallback()
  })
  await page.getByRole('link', { name: 'Sizzle', exact: true }).click()
  await expect(page.getByText('Ready to import', { exact: true })).toBeVisible()
  return { data, item, requests }
}

for (const [width, action] of [
  [390, 'Enter'],
  [1280, 'Import'],
] as const) {
  test(`pasted URLs wait for ${action} and polling adds the recipe at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    const { data, requests } = await galleryFixture(page)
    const input = page.getByRole('textbox', { name: 'Add a recipe', exact: true })
    await expect(input).toBeVisible()
    await paste(input, 'https://example.com/curry')
    await expect(input).toHaveValue('https://example.com/curry')
    await expect(page.getByRole('button', { name: 'Import', exact: true })).toBeEnabled()
    expect(requests).toEqual([])
    if (action === 'Enter') await input.press('Enter')
    else await page.getByRole('button', { name: 'Import', exact: true }).click()
    await expect(page.getByText('Reading the page', { exact: true })).toBeVisible()
    await expect(input).toHaveValue('')
    expect(requests).toEqual([{ url: 'https://example.com/curry' }])
    await expect(page).toHaveURL('/')
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

test('typing waits for Enter, and background failures stay visible on the gallery', async ({ page }) => {
  const { data, item, requests } = await galleryFixture(page)
  const input = page.getByRole('textbox', { name: 'Add a recipe', exact: true })
  await input.fill('https://example.com/curry')
  expect(requests).toEqual([])
  await input.press('Enter')
  await expect(page.getByText('Reading the page', { exact: true })).toBeVisible()
  data.props.pending_imports = []
  data.props.failed_imports = [{ ...item, status: 'failed', error: "That doesn't look like a recipe." }]
  await expect(page.getByRole('region', { name: 'Failed imports' })).toContainText("That doesn't look like a recipe.", {
    timeout: 10_000,
  })
  await expect(page.getByRole('link', { name: 'View imports and retry' })).toHaveAttribute('href', '/imports')
  await expect(input).toBeVisible()
  expect(requests).toHaveLength(1)
})

test('invalid pasted links validate on Import and stay editable', async ({ page }) => {
  const { requests } = await galleryFixture(page)
  const input = page.getByRole('textbox', { name: 'Add a recipe', exact: true })
  for (const text of ['file:///etc/passwd', 'ftp://example.com/recipe']) {
    await paste(input, text)
    await expect(page.getByRole('alert')).not.toBeVisible()
    await expect(input).toHaveValue(text)
    expect(requests).toEqual([])
    await page.getByRole('button', { name: 'Import', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Paste a complete recipe URL')
    await expect(input).toHaveValue(text)
    await expect(input).toHaveAttribute('aria-invalid', 'true')
  }
  expect(requests).toEqual([])
  await input.fill('https://example.com/curry')
  await expect(page.getByRole('alert')).not.toBeVisible()
})

test('server validation errors stay on the gallery and preserve the URL', async ({ page }) => {
  await page.goto('/')
  const input = page.getByRole('textbox', { name: 'Add a recipe', exact: true })
  await input.fill('https://example.com:6379/pie')
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page.locator('#recipe-url-error')).toContainText('port 6379 is not allowed')
  await expect(input).toHaveValue('https://example.com:6379/pie')
  await expect(page).toHaveURL('/')
})
