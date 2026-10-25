import { expect, test, type Locator, type Page } from '@playwright/test'

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
  recipe_image_url: null,
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
    app: { ...data.props.app, claude_configured: true },
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

async function paste(input: Locator, text: string) {
  const allowed = await input.evaluate((element, pastedText) => {
    const clipboardData = new DataTransfer()
    clipboardData.setData('text/plain', pastedText)
    return element.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }))
  }, text)
  // Synthetic paste events do not insert text. Emulate the default edit if allowed.
  if (allowed) await input.fill(text)
}

// The Add recipe page with each posted link answered as a pending import.
async function importsFixture(page: Page) {
  await page.goto('/imports')
  const data = JSON.parse((await page.locator('script[data-page="app"]').textContent())!)
  Object.assign(data.props, {
    imports: [],
    mode: 'import',
    source_url: null,
    submitted_import_ids: [],
    app: { ...data.props.app, claude_configured: true },
  })
  data.flash = { notice: 'Import fixture ready' }
  const requests: { input: string }[] = []
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname === '/imports' && request.method() === 'POST') {
      const body = request.postDataJSON()
      requests.push(body)
      const batch = body.input
        .split(/\s+/)
        .filter(Boolean)
        .map((link: string, index: number) => ({
          ...sharedImport,
          id: 101 + data.props.imports.length + index,
          origin: 'web',
          url: link,
        }))
      data.props.imports = [...batch, ...data.props.imports]
      data.props.submitted_import_ids = batch.map((item: { id: number }) => item.id)
      data.flash = {}
      return route.fulfill({ json: data, headers: { 'X-Inertia': 'true' } })
    }
    if (url.pathname === '/imports' && request.headers()['x-inertia']) {
      return route.fulfill({ json: data, headers: { 'X-Inertia': 'true' } })
    }
    return route.fallback()
  })
  await page.getByRole('link', { name: 'Add recipe', exact: true }).click()
  await expect(page.getByText('Import fixture ready', { exact: true })).toBeVisible()
  return { requests, data }
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

for (const width of [390, 1280]) {
  test(`submitted recipes stay below the cleared form through polling at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const { data, requests } = await importsFixture(page)
    data.props.imports = Array.from({ length: 5 }, (_, index) => ({
      ...sharedImport,
      id: 100 - index,
      url: `https://example.com/older-recipe-${index}`,
      status: 'done',
      recipe_id: 400 + index,
      recipe_title: ['Lemon salmon', 'Carrot soup', 'Banana bread', 'Older rice', 'Older pasta'][index],
      created_at: '2026-10-20T14:30:00Z',
    }))
    await page.route('**/test-recipe.webp', (route) =>
      route.fulfill({ path: 'db/seeds/images/curry.webp', contentType: 'image/webp' }),
    )
    await page.evaluate(() => {
      document.addEventListener('animationstart', (event) => {
        if (event.animationName === 'import-arrive' && event.target instanceof HTMLElement) {
          event.target.dataset.arrivals = String(Number(event.target.dataset.arrivals ?? 0) + 1)
        }
      })
    })

    const input = page.locator('#input')
    await input.fill('https://example.com/curry\nhttps://example.com/soup')
    await page.getByRole('button', { name: 'Import', exact: true }).click()
    const submitted = page.getByRole('region', { name: 'Your imports', exact: true })
    const recent = page.getByRole('region', { name: 'Recent imports', exact: true })
    await expect(input).toHaveValue('')
    await expect(submitted.getByRole('listitem')).toHaveCount(2)
    await expect(submitted.getByRole('status')).toHaveText('2 importing')
    await expect(recent).toContainText('Lemon salmon')
    await expect(recent.getByRole('listitem')).toHaveCount(3)
    await expect(recent.getByText('Older rice', { exact: true })).toHaveCount(0)
    await expect(recent.locator('time').first()).toHaveAttribute('datetime', '2026-10-20T14:30:00Z')
    await expect(recent.locator('time').first()).toHaveAttribute('title', /^Added /)
    // The batch follows paste order, not the worker's completion order.
    await expect(submitted.getByRole('listitem').first()).toContainText('https://example.com/curry')
    expect(
      await submitted.evaluate((section) => {
        const form = document.querySelector('form')!
        return !!(form.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING)
      }),
    ).toBe(true)
    const curry = submitted.locator('#import-106')
    await expect(curry).toHaveAttribute('data-arrivals', '1')
    await input.fill('https://example.com/next-recipe')
    data.props.imports.find((item: { id: number }) => item.id === 106).status = 'saving'
    await expect(curry).toContainText('Saving photos', { timeout: 10_000 })
    await expect(input).toHaveValue('https://example.com/next-recipe')
    await expect(curry).toHaveAttribute('data-arrivals', '1')

    // A second submission adds to this session without replacing the first batch.
    await page.getByRole('button', { name: 'Import', exact: true }).click()
    await expect(input).toHaveValue('')
    await expect(submitted.getByRole('listitem')).toHaveCount(3)
    await expect(submitted.getByRole('listitem').first()).toContainText('https://example.com/next-recipe')
    await expect(curry).toHaveAttribute('data-arrivals', '1')
    expect(requests).toHaveLength(2)

    await input.fill('My next draft stays here')
    Object.assign(
      data.props.imports.find((item: { id: number }) => item.id === 106),
      {
        status: 'done',
        recipe_id: 501,
        recipe_title: 'Chickpea curry',
        recipe_image_url: '/test-recipe.webp',
      },
    )
    Object.assign(
      data.props.imports.find((item: { id: number }) => item.id === 107),
      {
        status: 'failed',
        error: 'This site blocked the request. Write the recipe manually instead.',
      },
    )
    await expect(curry.getByRole('link', { name: 'Chickpea curry', exact: true })).toHaveAttribute(
      'href',
      '/recipes/501',
      { timeout: 10_000 },
    )
    await expect(curry).toContainText('Saved')
    await expect(curry.locator('.import-dot')).toHaveCount(0)
    await expect(curry.locator('img')).toBeVisible()
    await expect(curry.locator('img')).toHaveCSS('opacity', '1')
    expect(await curry.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
    await expect(curry).toHaveAttribute('data-arrivals', '1')
    await expect(submitted.getByRole('button', { name: 'Try again' })).toBeVisible()
    await expect(submitted.getByRole('status')).toHaveText('1 importing · 1 saved · 1 needs attention')
    await expect(input).toHaveValue('My next draft stays here')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await input.fill('')
    await input.blur()
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: testInfo.outputPath(`import-progress-${width}.png`), fullPage: true })
  })
}

test('reduced motion keeps submission and completion feedback without decorative movement', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 500 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const { data } = await importsFixture(page)
  await page.evaluate(() => {
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function (options) {
      if (this instanceof HTMLElement && options && typeof options === 'object') {
        this.dataset.scrollBehavior = options.behavior
      }
      return original.call(this, options)
    }
  })
  await page.locator('#input').fill('https://example.com/curry')
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  const card = page.getByRole('region', { name: 'Your imports', exact: true }).getByRole('listitem')
  await expect(card).toHaveCSS('animation-name', 'none')
  await expect(card).toHaveAttribute('data-scroll-behavior', 'instant')
  await expect(card.locator('.import-dot').first()).toHaveCSS('animation-name', 'none')
  Object.assign(data.props.imports[0], { status: 'done', recipe_id: 501, recipe_title: 'Chickpea curry' })
  await expect(card.getByRole('link', { name: 'Chickpea curry' })).toBeVisible({ timeout: 10_000 })
  await expect(card.locator('.import-saved')).toHaveCSS('animation-name', 'none')
  await expect(page.locator('#input')).toHaveValue('')
})
