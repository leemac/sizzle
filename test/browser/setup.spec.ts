import { expect, test, type Page } from '@playwright/test'

// The radios are visually hidden inside their cards, so click the card like a person would.
const choose = (page: Page, name: RegExp) =>
  page
    .locator('label')
    .filter({ has: page.getByRole('radio', { name }) })
    .click()

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === 'http://sizzle.test:3211') return route.continue()
    return route.abort()
  })
})

for (const width of [390, 1280]) {
  for (const configured of [false, true]) {
    test(`setup with ${configured ? 'configured' : 'missing'} credentials at ${width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))

      // Vary only status flags in local Inertia responses; no external API requests.
      await page.route('**/setup*', async (route) => {
        if (!route.request().headers()['x-inertia']) return route.continue()
        // route.fetch runs in Node, outside Chromium's sizzle.test DNS mapping.
        const localUrl = new URL(route.request().url())
        const host = localUrl.host
        localUrl.hostname = '127.0.0.1'
        const response = await route.fetch({
          url: localUrl.href,
          headers: { ...route.request().headers(), host },
        })
        const body = await response.json()
        body.props.setup = {
          claude_configured: configured,
          version: 'dev',
        }
        await route.fulfill({ response, json: body })
      })

      await page.goto('/')
      await page.getByRole('link', { name: 'Setup', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Set up Sizzle' })).toBeVisible()
      await expect(page.getByRole('link', { name: '1 Your cookbook' })).toHaveAttribute('aria-current', 'step')
      await expect(page.getByText('Your cookbook is ready to use. No AI account or API key required.')).toBeVisible()
      await page.screenshot({ path: testInfo.outputPath(`setup-welcome-${width}.png`), fullPage: true })
      await page.getByRole('link', { name: 'Continue', exact: true }).click()

      // Picking a look can't be skipped: nothing is preselected and Continue waits for both choices.
      await expect(page.getByRole('heading', { name: 'Pick a look', exact: true })).toBeVisible()
      await expect(page.getByText('Step 2 of 3', { exact: true })).toBeVisible()
      const next = page.getByRole('button', { name: 'Continue', exact: true })
      await expect(next).toBeDisabled()
      await choose(page, /Pesto/)
      await expect(next).toBeDisabled()
      await choose(page, /Dark/)
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'pesto')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath(`setup-look-${width}.png`), fullPage: true })
      await next.click()

      await expect(page.getByRole('heading', { name: 'Your first recipe', exact: true })).toBeVisible()
      await expect(page.getByText('Step 3 of 3', { exact: true })).toBeVisible()
      await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark')
      await expect(page.getByRole('link', { name: 'Keep it private' })).toHaveCount(0)
      await expect(page.getByText('Generate a token on your server:', { exact: true })).toHaveCount(0)
      await expect(page.getByText('Advanced server setup', { exact: true })).toHaveCount(0)
      await expect(page.getByRole('link', { name: 'Add your first recipe', exact: true })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Write a recipe', exact: true })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath(`setup-ready-${width}.png`), fullPage: true })

      await page.goBack()
      await expect(page.getByRole('heading', { name: 'Pick a look', exact: true })).toBeVisible()
      // A page restored from history still shows the look that was just saved.
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'pesto')
      await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark')
      await page.goForward()
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'pesto')
      // Saving the look redirected to this step outside the stubbed /setup route, so load it again through it.
      await page.getByRole('link', { name: '3 Add a recipe', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Your first recipe', exact: true })).toBeVisible()

      await page.getByRole('link', { name: configured ? 'Review AI setup' : 'Set up optional AI', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Optional AI extraction', exact: true })).toBeVisible()
      await expect(page.getByRole('status')).toContainText(configured ? 'Claude API key is configured' : 'AI is off')
      await page.screenshot({ path: testInfo.outputPath(`setup-claude-${width}.png`), fullPage: true })
      await page.getByRole('link', { name: 'Check again', exact: true }).click()
      await expect(page.getByRole('status')).toContainText(configured ? 'Claude API key is configured' : 'AI is off')
      await page.getByRole('link', { name: configured ? 'Add a recipe' : 'Continue without AI', exact: true }).click()

      await page.getByRole('link', { name: 'Add your first recipe', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Add a recipe', exact: true })).toBeVisible()
      await expect(page.getByRole('alert')).toHaveCount(0)
      await page.getByRole('link', { name: 'Write a recipe', exact: true }).click()
      await expect(page.getByLabel('Recipe title', { exact: true })).toBeVisible()
      await page.goBack()
      await page.goBack()
      await expect(page.getByRole('heading', { name: 'Your first recipe', exact: true })).toBeVisible()
      await page.getByRole('link', { name: 'Set up phone sharing', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Build the Shortcut' })).toBeVisible()
      expect(errors).toEqual([])
    })
  }
}
