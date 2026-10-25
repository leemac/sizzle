import { expect, test } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === 'http://sizzle.test:3211') return route.continue()
    return route.abort()
  })
})

for (const width of [390, 1280]) {
  test(`settings persist and cooking mode releases the screen at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript(() => {
      const calls = { requested: 0, released: 0 }
      Object.defineProperty(window, 'wakeCalls', { value: calls })
      Object.defineProperty(window, 'isSecureContext', { value: true })
      Object.defineProperty(navigator, 'wakeLock', {
        value: {
          request: async () => {
            calls.requested++
            const lock = new EventTarget()
            Object.assign(lock, {
              release: async () => {
                calls.released++
                lock.dispatchEvent(new Event('release'))
              },
            })
            return lock
          },
        },
      })
    })
    await page.goto('/')
    await page.getByRole('link', { name: 'Settings', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
    await expect(page.getByLabel('When a web import needs Claude')).toHaveValue('ask')
    await page.getByLabel('Recipe text in cooking mode').selectOption('large')
    await page.getByLabel('Keep the screen awake while cooking').check()
    await page.getByLabel('Recipe order', { exact: true }).selectOption('alphabetical')
    await page.getByRole('button', { name: 'Save preferences', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Preferences saved.' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save preferences', exact: true })).toBeDisabled()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: testInfo.outputPath(`settings-${width}.png`), fullPage: true })
    await page.reload()
    await expect(page.getByLabel('Recipe text in cooking mode')).toHaveValue('large')
    await expect(page.getByLabel('Keep the screen awake while cooking')).toBeChecked()
    await expect(page.getByLabel('Recipe order', { exact: true })).toHaveValue('alphabetical')

    // A real browser download exercises the normal form and its CSRF token.
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download cookbook', exact: true }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^sizzle-cookbook-.*\.tar\.gz$/)
    expect(await download.failure()).toBeNull()

    await page.goto('/imports?mode=manual')
    const title = `Cooking preferences ${width}`
    await page.getByLabel('Recipe title', { exact: true }).fill(title)
    await page.getByLabel('Ingredients', { exact: true }).fill('2 tbsp olive oil\n1 onion')
    await page.getByLabel('Method', { exact: true }).fill('Warm the oil in a large pan over medium heat.')
    await page.getByRole('button', { name: 'Save recipe', exact: true }).click()
    const ingredient = page.getByRole('button', { name: '2 tbsp olive oil', exact: true })
    const originalSize = await ingredient.evaluate((element) => getComputedStyle(element).fontSize)
    await page.getByRole('button', { name: 'Start cooking', exact: true }).click()
    await expect(page.getByText('Your screen will stay awake while this page is visible.')).toBeVisible()
    expect(await ingredient.evaluate((element) => getComputedStyle(element).fontSize)).not.toBe(originalSize)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`cooking-${width}.png`), fullPage: true })
    await ingredient.click()
    await page.getByRole('button', { name: 'Done cooking', exact: true }).click()
    await expect(ingredient).toHaveAttribute('aria-pressed', 'true')
    expect(await ingredient.evaluate((element) => getComputedStyle(element).fontSize)).toBe(originalSize)
    const wakeCalls = () =>
      page.evaluate(() => (window as unknown as { wakeCalls: { requested: number; released: number } }).wakeCalls)
    await expect.poll(async () => (await wakeCalls()).released).toBe(1)
    await page.getByRole('button', { name: 'Start cooking', exact: true }).click()
    await expect.poll(async () => (await wakeCalls()).requested).toBe(2)
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await expect.poll(async () => (await wakeCalls()).released).toBe(2)
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await expect.poll(async () => (await wakeCalls()).requested).toBe(3)
    await page.getByRole('link', { name: 'Cooking preferences', exact: true }).click()
    await expect.poll(async () => (await wakeCalls()).released).toBe(3)

    await page.goto('/')
    await expect(page.getByLabel('Recipe order', { exact: true })).toHaveValue('alphabetical')
    await page.getByLabel('Recipe order', { exact: true }).selectOption('never_cooked')
    await expect(page.getByLabel('Recipe order', { exact: true })).toHaveValue('never_cooked')
    await page.reload()
    await expect(page.getByLabel('Recipe order', { exact: true })).toHaveValue('never_cooked')
    await page
      .getByRole('link')
      .filter({ has: page.getByRole('heading', { name: title, exact: true }) })
      .click()
    await page.getByRole('button', { name: 'Delete recipe', exact: true }).click()
    await page.getByRole('button', { name: 'Delete recipe', exact: true }).click()
    expect(errors).toEqual([])
  })
}

test('a refused screen wake lock leaves cooking mode usable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'isSecureContext', { value: true })
    Object.defineProperty(navigator, 'wakeLock', { value: { request: () => Promise.reject(new Error('Not allowed')) } })
  })
  await page.goto('/settings')
  await page.getByLabel('Keep the screen awake while cooking').check()
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click()
  await page.goto('/imports?mode=manual')
  await page.getByLabel('Recipe title', { exact: true }).fill('Wake lock fallback')
  await page.getByLabel('Ingredients', { exact: true }).fill('1 cup rice')
  await page.getByLabel('Method', { exact: true }).fill('Cook the rice.')
  await page.getByRole('button', { name: 'Save recipe', exact: true }).click()
  await page.getByRole('button', { name: 'Start cooking', exact: true }).click()
  await expect(page.getByText('Your browser couldn’t keep the screen awake.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: '1 cup rice', exact: true }).click()
  await expect(page.getByRole('button', { name: '1 cup rice', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Delete recipe', exact: true }).click()
  await page.getByRole('button', { name: 'Delete recipe', exact: true }).click()
})
