// Capture seasonal hero cards from the disposable, seeded Sizzle demo.
import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { promisify } from 'node:util'

const base = new URL(process.argv[2] || 'http://localhost:3212')
if (!['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) throw new Error('Use a loopback demo URL.')
const output = resolve(process.argv[3] || 'site/images')
const recipes = [
  ['roast-chicken', 'Golden rosemary roast chicken'],
  ['soup', 'Roasted carrot and ginger soup'],
  ['apple-crumble', 'Warm apple crumble tarts'],
  ['cookies', 'Chocolate chunk cookies with flaky salt'],
  ['ramen', 'Miso ramen with salmon and soft-boiled eggs'],
  ['lasagna', 'Bubbling beef lasagna'],
  ['salmon', 'Lemon salmon with cucumber salsa'],
  ['spring-pasta', 'Lemon pea and mint pasta'],
  ['strawberry-tart', 'Strawberry cream tart'],
  ['berry-tarts', 'Little summer berry lattice tarts'],
  ['tacos', 'Smoky sweetcorn and black bean tacos'],
  ['grilled-corn', 'Charred corn with lime butter'],
]
const encode = promisify(execFile)
await mkdir(output, { recursive: true })
const scratch = await mkdtemp(resolve(tmpdir(), 'sizzle-hero-'))
const browser = await chromium.launch()
try {
  for (const colorScheme of ['light', 'dark']) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 1000 },
      deviceScaleFactor: 2,
      reducedMotion: 'reduce',
      colorScheme,
    })
    await context.route('**/*', (route) =>
      new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort(),
    )
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(base.href)
    await page.getByRole('heading', { name: 'Your cookbook', exact: true }).waitFor()
    const background = await page.locator('html').evaluate((el) => getComputedStyle(el).backgroundColor)
    const expected = colorScheme === 'dark' ? 'rgb(20, 20, 22)' : 'rgb(246, 246, 243)'
    if (background !== expected) {
      throw new Error(
        `Demo does not render ${colorScheme} mode. Use the capture revision in references/screenshots.md.`,
      )
    }
    const links = await page
      .locator('section[aria-label="Recipes"] > a')
      .evaluateAll((els) =>
        els.map((el) => ({ title: el.querySelector('h2, h3')?.textContent, href: el.getAttribute('href') })),
      )
    for (const [slug, title] of recipes) {
      const link = links.find((link) => link.title === title)
      if (!link) throw new Error(`Missing bundled sample: ${title}`)
      await page.goto(new URL(link.href, base).href)
      await page.getByRole('heading', { name: title, exact: true }).waitFor()
      await page.evaluate(async () => {
        await document.fonts.ready
        await Promise.all([...document.images].filter((img) => img.loading !== 'lazy').map((img) => img.decode()))
      })
      const png = resolve(scratch, `${slug}.png`)
      await page.screenshot({ path: png, animations: 'disabled', scale: 'device' })
      const suffix = colorScheme === 'dark' ? '-dark' : ''
      await encode('cwebp', [
        '-quiet',
        '-lossless',
        '-z',
        '6',
        png,
        '-o',
        resolve(output, `hero-${slug}-390@2x${suffix}.webp`),
      ])
      console.log(`Captured ${title} (${colorScheme})`)
    }
    if (errors.length) throw new Error(errors.join('\n'))
    await context.close()
  }
} finally {
  await browser.close()
  await rm(scratch, { recursive: true, force: true })
}
