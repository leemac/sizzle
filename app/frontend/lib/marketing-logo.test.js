// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import SizzleLogo from '../components/SizzleLogo'
import appConfig from '../components/sizzle-logo-config.json'
import { animateLogo, config as marketingConfig, drawFlame } from '../../../site/sizzle-logo.js'
import marketingPage from '../../../site/index.html?raw'

let media
let cleanup
let hidden
const frames = new Map()
let nextFrame = 0

beforeEach(() => {
  document.body.innerHTML = new DOMParser().parseFromString(marketingPage, 'text/html').body.innerHTML
  media = Object.assign(new EventTarget(), { matches: false })
  vi.stubGlobal('matchMedia', () => media)
  vi.stubGlobal('requestAnimationFrame', (callback) => {
    frames.set(++nextFrame, callback)
    return nextFrame
  })
  vi.stubGlobal('cancelAnimationFrame', (id) => frames.delete(id))
  hidden = false
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
})

afterEach(() => {
  cleanup?.()
  cleanup = undefined
  document.body.innerHTML = ''
  frames.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function positions() {
  return [...document.querySelectorAll('rect')].map((pixel) => pixel.getAttribute('y'))
}

it('animates the marketing wordmark while preserving its accessible home link', () => {
  cleanup = animateLogo(document.querySelector('.sizzle-logo__particles'))
  const logo = document.querySelector('.wordmark')
  expect(logo.textContent).toBe('Sizzle')
  expect(logo.getAttribute('aria-label')).toBe('Sizzle')
  expect(logo.getAttribute('href')).toBe('/')
  expect(logo.querySelectorAll('rect')).toHaveLength(60)
  expect(logo.querySelector('img').getAttribute('src')).toBe('/icon.svg')
  expect(logo.querySelector('img').getAttribute('alt')).toBe('')
  const initial = positions()
  for (const time of [1000, 1050]) {
    const [id, callback] = [...frames][0]
    frames.delete(id)
    callback(time)
  }
  expect(positions()).not.toEqual(initial)
})

it('keeps visible static particles for reduced motion and responds to preference changes', () => {
  media.matches = true
  cleanup = animateLogo(document.querySelector('.sizzle-logo__particles'))
  expect(frames.size).toBe(0)
  expect([...document.querySelectorAll('rect')].some((pixel) => Number(pixel.getAttribute('opacity')) > 0)).toBe(true)
  media.matches = false
  media.dispatchEvent(new Event('change'))
  expect(frames.size).toBe(1)
  media.matches = true
  media.dispatchEvent(new Event('change'))
  expect(frames.size).toBe(0)
})

it('pauses in hidden tabs and cleans up its animation and listeners', () => {
  cleanup = animateLogo(document.querySelector('.sizzle-logo__particles'))
  expect(frames.size).toBe(1)
  hidden = true
  document.dispatchEvent(new Event('visibilitychange'))
  expect(frames.size).toBe(0)
  hidden = false
  document.dispatchEvent(new Event('visibilitychange'))
  expect(frames.size).toBe(1)
  cleanup()
  document.dispatchEvent(new Event('visibilitychange'))
  media.dispatchEvent(new Event('change'))
  expect(frames.size).toBe(0)
})

// Vitest stubs CSS imports, even ?raw ones, so read the stylesheets from disk.
const appStyles = readFileSync(resolve(import.meta.dirname, '../entrypoints/application.css'), 'utf8')
const marketingStyles = readFileSync(resolve(import.meta.dirname, '../../../site/styles.css'), 'utf8')

// The app header and the marketing site draw the same logo. These fail when one changes without the other.
function flameRule(css) {
  const block = css.match(/sizzle-logo-flame:start[^\n]*\n([\s\S]*?)\/\* sizzle-logo-flame:end/)
  expect(block).not.toBeNull()
  return block[1]
}

function flamePixels(field) {
  return [...field.querySelectorAll('rect')].map((pixel) => ({
    x: pixel.getAttribute('x'),
    y: pixel.getAttribute('y'),
    width: pixel.getAttribute('width'),
    height: pixel.getAttribute('height'),
    delay: pixel.style.getPropertyValue('--flame-delay'),
    duration: pixel.style.getPropertyValue('--flame-duration'),
    rise: pixel.style.getPropertyValue('--flame-rise'),
  }))
}

it('uses the same particle settings as the app logo', () => {
  expect(marketingConfig).toEqual(appConfig)
})

it('uses the same flame styles as the app logo', () => {
  expect(flameRule(marketingStyles)).toBe(flameRule(appStyles))
})

it('draws the same flame pixels as the app logo', () => {
  const marketingFlame = document.querySelector('.sizzle-logo__flame')
  drawFlame(marketingFlame)

  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  act(() => root.render(createElement(SizzleLogo)))
  const appFlame = container.querySelector('.sizzle-logo__flame')

  expect(marketingFlame.getAttribute('viewBox')).toBe(appFlame.getAttribute('viewBox'))
  expect(flamePixels(marketingFlame)).toHaveLength(24)
  expect(flamePixels(marketingFlame)).toEqual(flamePixels(appFlame))
  act(() => root.unmount())
})
