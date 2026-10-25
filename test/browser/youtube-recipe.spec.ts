import { expect, test } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === 'http://sizzle.test:3211') return route.continue()
    return route.abort()
  })
})

for (const width of [390, 1280]) {
  test(`video directions are linked beside the method at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const videoId = crypto.randomUUID().replaceAll('-', '').slice(0, 11)
    const title = `Video coconut rice ${width} ${videoId}`
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`
    await page.goto('/imports?mode=manual')
    await page.getByLabel('Recipe title', { exact: true }).fill(title)
    await page.getByLabel('Source link (optional)', { exact: true }).fill(`https://youtu.be/${videoId}?si=share`)
    await page.getByLabel('Ingredients', { exact: true }).fill('1 cup rice\n1 cup coconut milk')
    await page.getByLabel('Method', { exact: true }).fill('Rinse the rice.\nSimmer for 20 minutes.')
    await page.getByRole('button', { name: 'Save recipe', exact: true }).click()

    const video = page.getByRole('link', { name: 'Watch on YouTube Video directions', exact: true })
    await expect(video).toBeVisible()
    await expect(video).toHaveAttribute('href', watchUrl)
    await expect(video).toHaveAttribute('target', '_blank')
    await expect(video).toHaveAttribute('rel', 'noopener noreferrer nofollow')
    await expect(video.locator('svg')).toHaveCount(2)
    await expect(page.locator('iframe, video')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`youtube-recipe-${width}.png`), fullPage: true })

    // Local Inertia fixture for the metadata UI; Ruby tests cover fetching, validation and persistence.
    const recipeUrl = page.url()
    await page.route(recipeUrl, async (route) => {
      if (!route.request().headers()['x-inertia']) return route.fallback()
      const localUrl = new URL(route.request().url())
      const host = localUrl.host
      localUrl.hostname = '127.0.0.1'
      const response = await route.fetch({ url: localUrl.href, headers: { ...route.request().headers(), host } })
      const body = await response.json()
      Object.assign(body.props.recipe, {
        youtube_duration_seconds: 512,
        written_recipe_url: 'https://example.com/written-rice',
        youtube_chapters: [
          { start_seconds: 0, title: 'Ingredients', url: `${watchUrl}&t=0s` },
          { start_seconds: 90, title: 'Simmer the rice', url: `${watchUrl}&t=90s` },
        ],
      })
      await route.fulfill({ response, json: body })
    })
    await page.getByRole('link', { name: 'All recipes', exact: true }).click()
    await page.locator(`a[href="${new URL(recipeUrl).pathname}"]`).click()
    await expect(page.getByText('Video directions · 8:32 video', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Written recipe', exact: true })).toHaveAttribute(
      'href',
      'https://example.com/written-rice',
    )
    await page.getByText('Video chapters', { exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('link', { name: '1:30 Simmer the rice', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: '1:30 Simmer the rice', exact: true })).toHaveAttribute(
      'href',
      `${watchUrl}&t=90s`,
    )
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: testInfo.outputPath(`youtube-metadata-${width}.png`), fullPage: true })
    await page.unroute(recipeUrl)

    await page.getByRole('link', { name: 'Edit recipe', exact: true }).first().click()
    await page.getByLabel('Source link (optional)', { exact: true }).fill(`https://example.com/video-rice-${videoId}`)
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await expect(video).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Written recipe', exact: true })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'example.com', exact: true })).toHaveAttribute(
      'href',
      `https://example.com/video-rice-${videoId}`,
    )
  })
}
