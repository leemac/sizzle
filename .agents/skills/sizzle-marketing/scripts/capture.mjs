// Run from the Sizzle checkout; uses its existing Playwright installation.
import { createRequire } from 'node:module'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const require = createRequire(resolve('package.json'))
const { chromium } = require('@playwright/test')
const base = new URL(process.argv[2] || 'http://localhost:3212')
if (!['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) {
  throw new Error('Use a local demo instance, with bundled seed recipes only.')
}
const output = resolve(process.argv[3] || 'site/images')
await mkdir(output, { recursive: true })
const encode = promisify(execFile)
await encode('cwebp', ['-version'])
const scratch = await mkdtemp(resolve(tmpdir(), 'sizzle-screenshots-'))
const browser = await chromium.launch()
const errors = []
try {
  for (const colorScheme of ['light', 'dark']) {
    for (const width of [1280, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        deviceScaleFactor: 2,
        reducedMotion: 'reduce',
        colorScheme,
      })
      // No third-party browsing, external images, imports, or API calls.
      await context.route('**/*', (route) =>
        new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort(),
      )
      // Select supported app preferences; do not override rendered theme CSS.
      await context.addCookies([
        { name: 'sizzle_theme', value: 'sunny-side-up', url: base.href },
        { name: 'sizzle_mode', value: colorScheme, url: base.href },
      ])
      const page = await context.newPage()
      page.on('pageerror', (error) => errors.push(error.message))
      async function ready() {
        await page.evaluate(async () => {
          await document.fonts.ready
          await Promise.all(
            [...document.images]
              .filter((img) => {
                const rect = img.getBoundingClientRect()
                return img.loading !== 'lazy' || (rect.top < innerHeight && rect.bottom > 0)
              })
              .map((img) => img.decode()),
          )
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        })
        if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
          throw new Error(`Horizontal overflow at ${width}px: ${page.url()}`)
        }
      }
      async function save(name, locator, clip) {
        if (locator) {
          // Leave room above the crop for the app's sticky navigation/cooking toolbar.
          const bounds = await locator.boundingBox()
          await page.setViewportSize({ width, height: Math.max(1000, Math.ceil(bounds.height) + 240) })
          await locator.evaluate((el) => el.scrollIntoView({ block: 'start' }))
          await page.evaluate(() => window.scrollBy(0, -120))
        }
        await ready()
        await page.mouse.move(0, 0)
        const png = resolve(scratch, `${name}-${width}.png`)
        const options = {
          path: png,
          type: 'png',
          scale: 'device',
          animations: 'disabled',
        }
        if (locator) await locator.screenshot(options)
        else await page.screenshot({ ...options, ...(clip ? { clip } : {}) })
        const suffix = colorScheme === 'dark' ? '-dark' : ''
        await encode('cwebp', [
          '-quiet',
          '-lossless',
          '-z',
          '6',
          png,
          '-o',
          resolve(output, `${name}-${width}@2x${suffix}.webp`),
        ])
        await page.setViewportSize({ width, height: 1000 })
      }
      await page.goto(base.href)
      await page.getByRole('heading', { name: 'Your cookbook', exact: true }).waitFor()
      const background = await page.locator('html').evaluate((el) => getComputedStyle(el).backgroundColor)
      const expected = colorScheme === 'dark' ? 'rgb(20, 20, 22)' : 'rgb(246, 246, 243)'
      if (background !== expected) {
        throw new Error(
          `Demo does not render ${colorScheme} mode. Check the appearance preferences and current theme palette.`,
        )
      }
      await ready()
      const firstTile = await page.locator('section[aria-label="Recipes"] > a').first().boundingBox()
      await save('gallery', null, { x: 0, y: 0, width, height: Math.ceil(firstTile.y + firstTile.height + 12) })
      await page.getByRole('button', { name: 'Show as list', exact: true }).click()
      await save('list')
      const recipePath = await page
        .getByRole('link', { name: /Coconut vegetable korma/ })
        .first()
        .getAttribute('href')
      await page.goto(new URL(recipePath, base).href)
      await page.getByRole('heading', { name: 'Coconut vegetable korma', exact: true }).waitFor()
      await save('recipe', width === 1280 ? page.locator('article > header') : undefined)
      const ingredients = page
        .locator('article section')
        .filter({ has: page.getByRole('heading', { name: 'Ingredients', exact: true }) })
        .first()
      await ingredients.getByRole('button', { name: /neutral oil/ }).click()
      const method = page
        .locator('article section')
        .filter({ has: page.getByRole('heading', { name: 'Method', exact: true }) })
        .first()
      await method.getByRole('button').first().click()
      await save('cooking', width === 1280 ? ingredients.locator('..') : ingredients)
      await save('history', page.getByRole('complementary', { name: 'Recipe details' }))
      await page.goto(new URL('/imports', base).href)
      await page
        .getByRole('textbox', { name: /^Recipe links/ })
        .fill('https://example.com/vegetable-korma\nhttps://example.com/lemon-salmon')
      // Do not submit: these are illustrative links in the real app form.
      await save('import', width === 1280 ? page.locator('main > div') : undefined)
      await context.close()
    }
  }
  if (errors.length) throw new Error(errors.join('\n'))
  console.log(`Captured 24 real app views in light and dark at 2× resolution as lossless WebP in ${output}`)
} finally {
  await browser.close()
  await rm(scratch, { recursive: true, force: true })
}
