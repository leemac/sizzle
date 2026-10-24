// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { animateLogo } from '../../../site/sizzle-logo.js'
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
