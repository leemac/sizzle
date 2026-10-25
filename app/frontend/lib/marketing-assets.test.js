// @vitest-environment jsdom
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import marketingPage from '../../../site/index.html?raw'

it('changes marketing asset URLs whenever their contents change', () => {
  const page = new DOMParser().parseFromString(marketingPage, 'text/html')
  const assets = [...page.querySelectorAll('link[rel="stylesheet"][href], script[src]')]
  expect(assets.length).toBeGreaterThan(0)

  for (const asset of assets) {
    const url = new URL(asset.getAttribute('href') || asset.getAttribute('src'), 'https://sizzle.test')
    expect(url.origin).toBe('https://sizzle.test')
    const contents = readFileSync(resolve(import.meta.dirname, '../../../site', url.pathname.slice(1)))
    const hash = createHash('sha256').update(contents).digest('hex').slice(0, 12)
    expect(url.searchParams.get('v'), `Run node bin/update-marketing-assets.mjs for ${url.pathname}`).toBe(hash)
  }
})
