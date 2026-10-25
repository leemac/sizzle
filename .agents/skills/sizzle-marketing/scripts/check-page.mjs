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
  for (const colorScheme of ['light', 'dark']) {
    for (const width of [390, 1280]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        deviceScaleFactor: 2,
        reducedMotion: 'no-preference',
        colorScheme,
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
      // Keep summer uncached for the delayed-image check, regardless of today's season.
      await page.clock.setFixedTime(new Date(2026, 9, 15, 12))
      assert.equal((await page.goto(base.href)).status(), 200)
      await expect(page.locator('input[name="hero-season"]:checked')).toHaveValue('autumn')
      const background = colorScheme === 'dark' ? 'rgb(20, 20, 22)' : 'rgb(246, 246, 243)'
      const suffix = colorScheme === 'dark' ? '-dark' : ''
      assert(await page.getByLabel('System', { exact: true }).isChecked())
      assert.equal(await page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor), background)
      assert.equal(
        await page.locator('.theme-preview').evaluate((el) => getComputedStyle(el).backgroundColor),
        background,
      )
      const activeSeason = page.locator('.season-preview:visible')
      await page.locator('input[name="hero-season"][value="autumn"]').check()
      await expect(activeSeason).toHaveAttribute('data-season', 'autumn')
      await expect
        .poll(() =>
          activeSeason.locator('img').evaluateAll(async (imgs) => {
            try {
              await Promise.all(imgs.map((img) => img.decode()))
              return true
            } catch {
              // Allow the initial picture sources to settle on the system appearance.
              return false
            }
          }),
        )
        .toBe(true)

      // Hold an uncached card back: the old stack must stay intact, even with rapid selections.
      let releaseImage
      let imageRequested = false
      const imageGate = new Promise((resolve) => {
        releaseImage = resolve
      })
      const delayedImage = '**/images/hero-berry-tarts*'
      await page.route(delayedImage, async (route) => {
        imageRequested = true
        await imageGate
        await route.continue()
      })
      await page.locator('input[name="hero-season"][value="summer"]').check()
      await expect.poll(() => imageRequested, { message: 'An uncached summer card must be requested' }).toBe(true)
      await expect(activeSeason).toHaveAttribute('data-season', 'autumn')
      await page.locator('input[name="hero-season"][value="winter"]').check()
      await expect(activeSeason).toHaveAttribute('data-season', 'winter')
      releaseImage()
      await page
        .locator('[data-season="summer"] img')
        .evaluateAll((imgs) => Promise.all(imgs.map((img) => img.decode())))
      await expect(activeSeason).toHaveAttribute('data-season', 'winter')
      await page.unroute(delayedImage)
      await page.locator('input[name="hero-season"][value="summer"]').check()
      await expect(activeSeason).toHaveAttribute('data-season', 'summer')
      assert(
        await activeSeason
          .locator('img')
          .evaluateAll((imgs) => imgs.every((img) => img.complete && img.naturalWidth > 0)),
      )
      assert.equal(
        await activeSeason.locator('.recipe-stack').evaluate((el) => getComputedStyle(el).animationName),
        'none',
      )
      console.log(
        `${width}px ${colorScheme}: delayed image and rapid season changes keep complete cards visible without replaying the entrance`,
      )

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
      assert.equal(await page.locator('.hero-screen').evaluate((el) => getComputedStyle(el).animationName), 'none')
      assert.equal(
        await page
          .locator('.button')
          .first()
          .evaluate((el) => getComputedStyle(el).transitionDuration),
        '0s',
      )
      const previewHeight = await page.locator('.season-previews').evaluate((el) => el.getBoundingClientRect().height)
      for (const choice of await page.locator('input[name="hero-season"]').all()) {
        await choice.check()
        const active = page.locator('.season-preview:visible')
        await expect(active).toHaveAttribute('data-season', await choice.inputValue())
        assert.equal(await active.count(), 1)
        assert.equal(await active.getAttribute('data-season'), await choice.inputValue())
        assert.equal(await active.locator('.phone-screen').count(), 3)
        assert.equal(
          await page.locator('.season-previews').evaluate((el) => el.getBoundingClientRect().height),
          previewHeight,
          'Changing seasons must not move the cards or season picker',
        )
        await active.locator('img').evaluateAll((imgs) => Promise.all(imgs.map((img) => img.decode())))
        assert(
          await active
            .locator('img')
            .evaluateAll(
              (imgs, dark) => imgs.every((img) => img.currentSrc.includes('-dark.webp') === dark),
              colorScheme === 'dark',
            ),
        )
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      }
      const autumn = page.locator('input[name="hero-season"][value="autumn"]')
      await autumn.check()
      await expect(activeSeason).toHaveAttribute('data-season', 'autumn')
      await page.keyboard.press('Tab')
      await autumn.focus()
      assert.equal(await autumn.locator('+ span').evaluate((el) => getComputedStyle(el).outlineStyle), 'solid')
      await page.keyboard.press('ArrowRight')
      await expect(page.locator('.season-preview:visible')).toHaveAttribute('data-season', 'winter')
      await autumn.check()
      await expect(activeSeason).toHaveAttribute('data-season', 'autumn')
      for (const img of await page.locator('img:visible').all()) {
        await img.scrollIntoViewIfNeeded()
        await img.evaluate((el) => el.decode())
        if ((await img.getAttribute('src'))?.includes('@2x')) {
          const pixels = await img.evaluate((el) => ({
            available: el.naturalWidth,
            required: el.getBoundingClientRect().width * devicePixelRatio,
            source: el.currentSrc,
          }))
          assert.equal(
            pixels.source.includes('-dark.webp'),
            colorScheme === 'dark',
            `Wrong screenshot mode: ${pixels.source}`,
          )
          assert(
            pixels.available >= pixels.required - 2,
            `Insufficient screenshot resolution: ${JSON.stringify(pixels)}`,
          )
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
      await page.getByLabel('System', { exact: true }).check()
      await page.locator('.themes').screenshot({ path: resolve(output, `marketing-themes-${width}${suffix}.png`) })
      await page.evaluate(() => scrollTo(0, 0))
      await page.screenshot({ path: resolve(output, `marketing-sizzle-${width}${suffix}.png`), fullPage: true })
      const otherMode = colorScheme === 'dark' ? 'light' : 'dark'
      const otherBackground = colorScheme === 'dark' ? 'rgb(246, 246, 243)' : 'rgb(20, 20, 22)'
      await page.emulateMedia({ colorScheme: otherMode })
      assert.equal(await page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor), otherBackground)
      await expect
        .poll(() => page.locator('.theme-preview').evaluate((el) => getComputedStyle(el).backgroundColor))
        .toBe(otherBackground)
      const heroImages = page.locator('.season-preview:visible img')
      await expect
        .poll(() =>
          heroImages.evaluateAll(
            (imgs, dark) => imgs.every((img) => img.currentSrc.includes('-dark.webp') === dark),
            otherMode === 'dark',
          ),
        )
        .toBe(true)
      await heroImages.evaluateAll((imgs) => Promise.all(imgs.map((img) => img.decode())))
      assert.deepEqual(errors, [])
      console.log(
        `${width}px ${colorScheme} at 2× density: system theme, matching screenshots, live mode changes, four seasons, image resolution, overflow, keyboard, reduced motion, 12 theme/mode combinations, console: passed`,
      )
      await context.close()
    }
    // Keep the script-free pass independent of the live appearance changes above.
    const noJSBrowser = await chromium.launch()
    const noJS = await noJSBrowser.newPage({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 900 },
      colorScheme,
    })
    await noJS.route('**/*', (route) =>
      new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort(),
    )
    await noJS.goto(base.href)
    const background = colorScheme === 'dark' ? 'rgb(20, 20, 22)' : 'rgb(246, 246, 243)'
    assert.equal(await noJS.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor), background)
    assert.equal(
      await noJS.locator('.theme-preview').evaluate((el) => getComputedStyle(el).backgroundColor),
      background,
    )
    assert(await noJS.getByLabel('System', { exact: true }).isChecked())
    for (const season of ['autumn', 'winter', 'spring', 'summer']) {
      await noJS.locator(`input[name="hero-season"][value="${season}"]`).check()
      await expect(noJS.locator('.season-preview:visible')).toHaveAttribute('data-season', season)
      await expect
        .poll(() =>
          noJS.locator('.season-preview:visible img').evaluateAll(async (imgs) => {
            try {
              await Promise.all(imgs.map((img) => img.decode()))
              return true
            } catch {
              // Include source state if a native picture selection never settles.
              return imgs.map((img) => ({ source: img.currentSrc, complete: img.complete, width: img.naturalWidth }))
            }
          }),
        )
        .toBe(true)
      assert(
        await noJS
          .locator('.season-preview:visible img')
          .evaluateAll(
            (imgs, dark) => imgs.every((img) => img.currentSrc.includes('-dark.webp') === dark),
            colorScheme === 'dark',
          ),
      )
    }
    assert(
      await noJS.locator('[data-reveal]').evaluateAll((els) => els.every((el) => getComputedStyle(el).opacity === '1')),
    )
    assert(await noJS.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    console.log(
      `Without JavaScript (${colorScheme}): system colors, matching screenshots, all four seasons, no overflow`,
    )
    await noJSBrowser.close()
  }
  const calendar = await browser.newPage()
  await calendar.route('**/*', (route) =>
    new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort(),
  )
  for (const [month, season] of [
    'winter',
    'winter',
    'spring',
    'spring',
    'spring',
    'summer',
    'summer',
    'summer',
    'autumn',
    'autumn',
    'autumn',
    'winter',
  ].entries()) {
    await calendar.clock.setFixedTime(new Date(2026, month, 15, 12))
    await calendar.goto(base.href)
    await expect(calendar.locator('input[name="hero-season"]:checked')).toHaveValue(season)
  }
  console.log('Calendar: correct initial season for all 12 months')
  const laptop = await browser.newPage({ reducedMotion: 'reduce' })
  await laptop.route('**/*', (route) =>
    new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort(),
  )
  for (const [width, height] of [
    [1728, 885],
    [1728, 1000],
    [1512, 870],
    [1440, 800],
    [1280, 800],
    [1280, 720],
  ]) {
    await laptop.setViewportSize({ width, height })
    await laptop.goto(base.href)
    await laptop.evaluate(() => document.fonts.ready)
    for (const season of ['autumn', 'winter', 'spring', 'summer']) {
      await laptop.locator(`input[name="hero-season"][value="${season}"]`).check()
      await expect(laptop.locator('.season-preview:visible')).toHaveAttribute('data-season', season)
      await laptop.evaluate(() => scrollTo(0, 0))
      for (const selector of ['.hero-copy', '.hero-screen', '.season-picker']) {
        const bounds = await laptop.locator(selector).boundingBox()
        assert(
          bounds.y >= 0 && bounds.y + bounds.height <= height,
          `${width}×${height}: ${season} ${selector} below fold`,
        )
      }
      assert(await laptop.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    }
    console.log(`${width}×${height}: full hero and all four season choices fit without scrolling`)
  }
} finally {
  await browser.close()
}
