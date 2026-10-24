import { expect, test, type Locator, type Page } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === 'http://sizzle.test:3211') return route.continue()
    return route.abort()
  })
})

async function paste(input: Locator, text: string) {
  const allowed = await input.evaluate((element, pastedText) => {
    const clipboardData = new DataTransfer()
    clipboardData.setData('text/plain', pastedText)
    return element.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }))
  }, text)
  // Synthetic paste events do not insert text. Emulate the default edit if allowed.
  if (allowed) await input.fill(text)
}

function pendingImport(id: number, url: string) {
  return {
    id,
    kind: 'url',
    origin: 'web',
    url,
    text_preview: null,
    status: 'fetching',
    error: null,
    recipe_id: null,
    recipe_title: null,
    created_at: new Date().toISOString(),
  }
}

// Exercise real Inertia forms and polling with local protocol responses.
// Controller and model tests cover validation, enqueueing and the pipeline.
async function importsFixture(page: Page) {
  await page.goto('/imports')
  const data = JSON.parse((await page.locator('script[data-page="app"]').textContent())!)
  Object.assign(data.props, { imports: [], mode: 'import', source_url: null, app: { claude_configured: true } })
  const requests: { input: string }[] = []
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname === '/imports' && request.method() === 'POST') {
      const body = request.postDataJSON()
      requests.push(body)
      data.props.imports = body.input
        .split(/\s+/)
        .filter(Boolean)
        .map((link: string, index: number) => pendingImport(101 + index, link))
      return route.fulfill({ json: data, headers: { 'X-Inertia': 'true' } })
    }
    if (url.pathname === '/imports' && request.headers()['x-inertia']) {
      return route.fulfill({ json: data, headers: { 'X-Inertia': 'true' } })
    }
    return route.fallback()
  })
  await page.getByRole('link', { name: 'Add recipe', exact: true }).click()
  return { data, requests }
}

for (const width of [390, 1280]) {
  test(`several pasted links import together at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    const { requests } = await importsFixture(page)
    const input = page.getByRole('textbox', { name: 'Recipe links or text', exact: true })
    await expect(input).toHaveAccessibleDescription(/one link per line/)

    const links = 'https://example.com/curry\nhttps://example.com/soup'
    await paste(input, links)
    expect(requests).toEqual([])
    await page.getByRole('button', { name: 'Import', exact: true }).click()

    await expect(page.getByText('Reading the page', { exact: true })).toHaveCount(2)
    await expect(page.getByText('https://example.com/curry', { exact: true })).toBeVisible()
    await expect(page.getByText('https://example.com/soup', { exact: true })).toBeVisible()
    await expect(input).toHaveValue('')
    expect(requests).toEqual([{ input: links }])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`import-links-${width}.png`), fullPage: true })
    expect(errors).toEqual([])
  })
}

test('a bad link rejects the batch, names the link and keeps the text', async ({ page }) => {
  await page.goto('/imports')
  const input = page.locator('#input')
  const links = 'https://example.com/pie\nhttps://example.com:6379/cake'
  await input.fill(links)
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page.locator('#input-error')).toContainText(
    'https://example.com:6379/cake: Url port 6379 is not allowed',
  )
  await expect(input).toHaveValue(links)
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  await expect(page).toHaveURL('/imports')
})

test('the gallery has no import box', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('form', { name: 'Add a recipe from a URL' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Add recipe', exact: true })).toHaveAttribute('href', '/imports')
})

test('the gallery shows pending imports until they finish, and failures with a retry link', async ({ page }) => {
  await page.goto('/')
  const data = JSON.parse((await page.locator('script[data-page="app"]').textContent())!)
  const item = pendingImport(101, 'https://example.com/curry')
  Object.assign(data.props, {
    recipes: [],
    total_count: 0,
    page: 1,
    has_more: false,
    filters: {},
    pending_imports: [item],
    failed_imports: [],
  })
  await page.route('**/*', (route) => {
    if (new URL(route.request().url()).pathname === '/' && route.request().headers()['x-inertia']) {
      return route.fulfill({ json: data, headers: { 'X-Inertia': 'true' } })
    }
    return route.fallback()
  })
  await page.getByRole('link', { name: 'Sizzle', exact: true }).click()
  await expect(page.getByText('Reading the page', { exact: true })).toBeVisible()

  data.props.pending_imports = []
  data.props.total_count = 1
  data.props.failed_imports = [{ ...item, id: 102, status: 'failed', error: "That doesn't look like a recipe." }]
  data.props.recipes = [
    {
      id: 102,
      title: 'Chickpea curry',
      cuisine: 'Indian',
      course: 'main',
      total_minutes: 30,
      source_host: 'example.com',
      favorite: false,
      image_url: null,
    },
  ]
  await expect(page.getByRole('heading', { name: 'Chickpea curry', exact: true })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('Reading the page', { exact: true })).not.toBeVisible()
  await expect(page.getByText('1 recipe', { exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Failed imports' })).toContainText("That doesn't look like a recipe.")
  await expect(page.getByRole('link', { name: 'View imports and retry' })).toHaveAttribute('href', '/imports')
})
