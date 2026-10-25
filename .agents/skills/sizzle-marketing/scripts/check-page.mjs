// Browser QA and review images for the static marketing page; run from the checkout.
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'

const require = createRequire(resolve('package.json'))
const { chromium, expect } = require('@playwright/test')
const base = new URL(process.argv[2] || 'http://127.0.0.1:4174')
if (!['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) throw new Error('Use a loopback preview URL.')
const output = resolve('docs/screenshots')
await mkdir(output, { recursive: true })
const browser = await chromium.launch()
try {
  for (const width of [390, 1280]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      deviceScaleFactor: 2,
      reducedMotion: 'no-preference',
    })
    await context.route('**/*', (route) =>
      new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort(),
    )
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('response', (response) => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`)
    })
    assert.equal((await page.goto(base.href)).status(), 200)
    await page.keyboard.press('Tab')
    assert.equal(await page.locator(':focus').evaluate((el) => getComputedStyle(el).outlineStyle), 'solid')
    assert(await page.locator('html').evaluate((el) => el.classList.contains('motion-ready')))
    for (const target of await page.locator('[data-reveal]').all()) {
      await target.scrollIntoViewIfNeeded()
      await expect(target).toHaveClass(/is-visible/)
    }
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect
      .poll(() =>
        page
          .locator('[data-reveal]')
          .evaluateAll((els) =>
            els.every((el) => getComputedStyle(el).opacity === '1' && getComputedStyle(el).transform === 'none'),
          ),
      )
      .toBe(true)
    assert.equal(await page.locator('.phone-screen').evaluate((el) => getComputedStyle(el).animationName), 'none')
    assert.equal(
      await page
        .locator('.button')
        .first()
        .evaluate((el) => getComputedStyle(el).transitionDuration),
      '0s',
    )
    for (const img of await page.locator('img').all()) {
      await img.scrollIntoViewIfNeeded()
      await img.evaluate((el) => el.decode())
      if ((await img.getAttribute('src'))?.includes('@2x')) {
        const pixels = await img.evaluate((el) => ({
          available: el.naturalWidth,
          required: el.getBoundingClientRect().width * devicePixelRatio,
          source: el.currentSrc,
        }))
        assert(pixels.available >= pixels.required - 2, `Insufficient screenshot resolution: ${JSON.stringify(pixels)}`)
      }
    }
    await page.evaluate(() => document.fonts.ready)
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    const preview = page.locator('.theme-preview')
    for (const theme of await page.locator('input[name="preview-theme"]').all()) {
      await theme.check()
      await page.getByLabel('Light', { exact: true }).check()
      const light = await preview.evaluate((el) => getComputedStyle(el).backgroundColor)
      await page.getByLabel('Dark', { exact: true }).check()
      assert.notEqual(await preview.evaluate((el) => getComputedStyle(el).backgroundColor), light)
    }
    await page.locator('input[value="sunny-side-up"]').check()
    await page.getByLabel('Light', { exact: true }).check()
    await page.locator('.themes').screenshot({ path: resolve(output, `marketing-themes-${width}.png`) })
    await page.evaluate(() => scrollTo(0, 0))
    await page.screenshot({ path: resolve(output, `marketing-sizzle-${width}.png`), fullPage: true })
    assert.deepEqual(errors, [])
    console.log(
      `${width}px at 2× density: image resolution, overflow, keyboard focus, scroll reveals, reduced motion, 12 theme/mode combinations, console: passed`,
    )
    await context.close()
  }
  const noJS = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 900 } })
  await noJS.goto(base.href)
  assert(
    await noJS.locator('[data-reveal]').evaluateAll((els) => els.every((el) => getComputedStyle(el).opacity === '1')),
  )
  assert(await noJS.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  console.log('Without JavaScript: content visible and no horizontal overflow')
} finally {
  await browser.close()
}
