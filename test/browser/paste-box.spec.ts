import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === 'http://sizzle.test:3211') return route.continue()
    return route.abort()
  })
})

const pendingImport = (id: number, url: string) => ({
  id,
  kind: 'url',
  origin: 'web',
  url,
  text_preview: null,
  status: 'fetching',
  error: null,
  recipe_id: null,
  recipe_title: null,
  recipe_image_url: null,
  created_at: new Date().toISOString(),
})

const recipe = (id: number, title: string) => ({
  id,
  title,
  cuisine: 'Indian',
  course: 'main',
  total_minutes: 30,
  source_host: 'example.com',
  image_url: null,
})

// The cookbook with one saved recipe. Posts from the paste box are answered the way the server would after its
// redirect: back on the cookbook with the new imports pending, with a field error, or on the import page for a
// duplicate. Controller tests cover what the server actually decides.
async function cookbookFixture(page: Page, { claude = true } = {}) {
  await page.goto('/imports?mode=manual')
  const imports = JSON.parse((await page.locator('script[data-page="app"]').textContent())!)
  await page.goto('/')
  const data = JSON.parse((await page.locator('script[data-page="app"]').textContent())!)
  Object.assign(data.props, {
    recipes: [recipe(1, 'Lemon tart')],
    total_count: 1,
    page: 1,
    has_more: false,
    filters: {},
    pending_imports: [],
    app: { ...data.props.app, claude_configured: claude },
    preferences: { ...data.props.preferences, ai_mode: 'automatic' },
  })
  data.flash = { notice: 'Cookbook fixture ready' }
  Object.assign(imports.props, { imports: [], app: { ...imports.props.app, claude_configured: claude } })
  const posts: Record<string, unknown>[] = []
  const answer = { next: 'accept' as 'accept' | 'error' | 'duplicate' }

  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const inertia = { headers: { 'X-Inertia': 'true' } }
    if (url.pathname === '/imports' && request.method() === 'POST') {
      const body = request.postDataJSON()
      posts.push(body)
      data.flash = {}
      if (answer.next === 'error') {
        return route.fulfill({
          json: { ...data, props: { ...data.props, errors: { input: 'Url port 6379 is not allowed' } } },
          ...inertia,
        })
      }
      if (answer.next === 'duplicate') {
        return route.fulfill({
          json: {
            ...imports,
            url: '/imports',
            props: {
              ...imports.props,
              mode: 'import',
              draft_input: body.input,
              duplicate_review: {
                token: 'review-token',
                entries: [
                  {
                    key: 'example.com/lemon-tart',
                    url: body.input,
                    occurrences: 1,
                    recipe_id: 1,
                    recipe_title: 'Lemon tart',
                    archived: false,
                    pending_id: null,
                  },
                ],
              },
            },
          },
          ...inertia,
        })
      }
      const links = String(body.input).split(/\s+/).filter(Boolean)
      data.props.pending_imports = [
        ...links.map((link, index) => pendingImport(200 + data.props.pending_imports.length + index, link)),
        ...data.props.pending_imports,
      ]
      return route.fulfill({ json: data, ...inertia })
    }
    if (url.pathname === '/' && request.headers()['x-inertia']) {
      return route.fulfill({ json: data, ...inertia })
    }
    if (url.pathname === '/imports' && request.method() === 'GET' && request.headers()['x-inertia']) {
      return route.fulfill({
        json: { ...imports, url: `${url.pathname}${url.search}`, props: { ...imports.props, mode: 'manual' } },
        ...inertia,
      })
    }
    return route.fallback()
  })

  // Load the fixture through a real Inertia visit.
  await page.getByRole('link', { name: 'Sizzle', exact: true }).click()
  await expect(page.getByText('Cookbook fixture ready', { exact: true })).toBeVisible()
  return { data, posts, answer, box: page.getByRole('textbox', { name: /^Recipe link/ }) }
}

for (const width of [390, 1280]) {
  test(`a link pasted on the cookbook imports in place at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    const { data, posts, box } = await cookbookFixture(page)

    await expect(page.getByRole('link', { name: 'Add recipe', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Import', exact: true })).toBeDisabled()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`paste-box-${width}.png`), fullPage: true })

    await box.fill('https://example.com/curry')
    await box.press('Enter')

    await expect(page.getByText('Reading the page', { exact: true })).toBeVisible()
    await expect(page.getByText('example.com', { exact: true }).first()).toBeVisible()
    await expect(box).toHaveValue('')
    await expect(page).toHaveURL('http://sizzle.test:3211/')
    expect(posts).toEqual([{ input: 'https://example.com/curry', automatic_ai: true, return_to: 'cookbook' }])
    await page.screenshot({ path: testInfo.outputPath(`paste-box-pending-${width}.png`), fullPage: true })

    // A draft typed while the first import runs survives polling.
    await box.fill('https://example.com/next')
    data.props.pending_imports = []
    data.props.total_count = 2
    data.props.recipes = [recipe(2, 'Chickpea curry'), recipe(1, 'Lemon tart')]
    await expect(page.getByRole('heading', { name: 'Chickpea curry', exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Reading the page', { exact: true })).toHaveCount(0)
    await expect(box).toHaveValue('https://example.com/next')
    await page.screenshot({ path: testInfo.outputPath(`paste-box-saved-${width}.png`), fullPage: true })
    expect(errors).toEqual([])
  })
}

test('a pasted batch grows the box, says how many links, and imports them together', async ({ page }) => {
  const { posts, box } = await cookbookFixture(page)
  const oneLine = (await box.boundingBox())!.height

  const links = 'https://example.com/curry\nhttps://example.com/soup\nhttps://example.com/cake'
  await box.fill(links)
  await expect(page.getByText('3 links · Enter imports them all', { exact: true })).toBeVisible()
  await expect.poll(async () => (await box.boundingBox())!.height).toBeGreaterThan(oneLine * 2)
  await page.getByRole('button', { name: 'Import', exact: true }).click()

  await expect(page.getByText('Reading the page', { exact: true })).toHaveCount(3)
  await expect(box).toHaveValue('')
  await expect.poll(async () => (await box.boundingBox())!.height).toBeLessThan(oneLine + 1)
  expect(posts.at(-1)).toEqual({ input: links, automatic_ai: true, return_to: 'cookbook' })
})

test('Shift+Enter adds a line instead of importing', async ({ page }) => {
  const { posts, box } = await cookbookFixture(page)

  await box.fill('https://example.com/curry')
  await box.press('Shift+Enter')
  await box.pressSequentially('https://example.com/soup')

  await expect(box).toHaveValue('https://example.com/curry\nhttps://example.com/soup')
  expect(posts).toEqual([])
})

test('a refused link keeps the text and shows the error under the box', async ({ page }) => {
  const { answer, box } = await cookbookFixture(page)
  answer.next = 'error'

  await box.fill('https://example.com:6379/pie')
  await box.press('Enter')

  await expect(page.getByRole('alert')).toHaveText('Url port 6379 is not allowed')
  await expect(box).toHaveValue('https://example.com:6379/pie')
  await expect(box).toHaveAttribute('aria-invalid', 'true')
  await expect(page).toHaveURL('http://sizzle.test:3211/')
})

test('a duplicate goes to the import page to choose, with the link kept', async ({ page }) => {
  const { answer, box } = await cookbookFixture(page)
  answer.next = 'duplicate'

  await box.fill('https://example.com/lemon-tart')
  await box.press('Enter')

  await expect(page.getByRole('heading', { name: 'Add a recipe', exact: true })).toBeVisible()
  await expect(page.locator('#input')).toHaveValue('https://example.com/lemon-tart')
  await expect(page.getByText('Lemon tart').first()).toBeVisible()
})

test('a PDF attached on the cookbook is read on Write a recipe', async ({ page }) => {
  await cookbookFixture(page)
  const uploads: string[] = []
  await page.route('**/imports/screenshots', async (route) => {
    uploads.push(route.request().postDataBuffer()?.toString('latin1') ?? '')
    await new Promise((resolve) => setTimeout(resolve, 300))
    return route.fulfill({ json: { fields: { title: 'Grandma’s scones' } } })
  })

  await page.locator('input[type="file"]').setInputFiles('test/fixtures/files/recipe-card.pdf')

  await expect(page.getByRole('heading', { name: 'Add a recipe', exact: true })).toBeVisible()
  await expect(page.getByText('Reading your PDF…', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Recipe title', { exact: true })).toHaveValue('Grandma’s scones')
  expect(uploads).toHaveLength(1)
  expect(uploads[0]).toContain('filename="recipe-card.pdf"')
})

test('without Claude, a dropped PDF points to writing the recipe instead', async ({ page }) => {
  const { box } = await cookbookFixture(page, { claude: false })
  await expect(page.getByRole('button', { name: 'Attach a PDF or screenshot' })).toHaveCount(0)

  const transfer = await page.evaluateHandle(() => {
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(new File(['%PDF-1.7'], 'card.pdf', { type: 'application/pdf' }))
    return dataTransfer
  })
  await box.dispatchEvent('dragover', { dataTransfer: transfer })
  await box.dispatchEvent('drop', { dataTransfer: transfer })

  await expect(page.getByRole('alert')).toHaveText(
    'Reading a PDF or screenshot needs Claude. Write the recipe instead.',
  )
  await expect(page).toHaveURL('http://sizzle.test:3211/')
})

test('reduced motion keeps the same feedback without movement', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const { box } = await cookbookFixture(page)

  await box.fill('https://example.com/curry')
  await box.press('Enter')

  const tile = page.getByRole('status').filter({ hasText: 'Reading the page' })
  await expect(tile).toBeVisible()
  await expect(box).toHaveValue('')
  // Motion drops transforms under reduced motion; the arrival is a plain fade at most.
  await expect
    .poll(() => tile.evaluate((element) => getComputedStyle(element.parentElement!).transform))
    .toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/)
})
