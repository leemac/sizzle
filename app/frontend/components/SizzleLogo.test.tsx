// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import SizzleLogo from './SizzleLogo'

let container: HTMLDivElement
let root: Root
let media: MediaQueryList
let hidden = false
let nextFrame = 0
const frames = new Map<number, FrameRequestCallback>()

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  media = Object.assign(new EventTarget(), { matches: false }) as MediaQueryList
  vi.stubGlobal('matchMedia', () => media)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback)
    return nextFrame
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  hidden = false
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  frames.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function setReducedMotion(matches: boolean) {
  Object.defineProperty(media, 'matches', { value: matches, configurable: true })
  media.dispatchEvent(new Event('change'))
}

function positions() {
  return [...container.querySelectorAll('rect')].map((pixel) => [pixel.getAttribute('x'), pixel.getAttribute('y')])
}

it('keeps a visible static particle field for reduced motion and responds to preference changes', () => {
  setReducedMotion(true)
  act(() => root.render(<SizzleLogo />))
  expect(frames.size).toBe(0)
  expect([...container.querySelectorAll('rect')].some((pixel) => Number(pixel.getAttribute('opacity')) > 0)).toBe(true)
  const still = positions()

  setReducedMotion(false)
  expect(frames.size).toBe(1)
  for (const time of [1000, 1050]) {
    const [id, callback] = [...frames][0]
    frames.delete(id)
    callback(time)
  }
  expect(positions()).not.toEqual(still)
  setReducedMotion(true)
  expect(frames.size).toBe(0)
})

it('suspends the animation while the document is hidden', () => {
  act(() => root.render(<SizzleLogo />))
  expect(frames.size).toBe(1)
  hidden = true
  document.dispatchEvent(new Event('visibilitychange'))
  expect(frames.size).toBe(0)
  hidden = false
  document.dispatchEvent(new Event('visibilitychange'))
  expect(frames.size).toBe(1)
})

it('cancels the frame and removes motion listeners on unmount', () => {
  act(() => root.render(<SizzleLogo />))
  expect(frames.size).toBe(1)
  act(() => root.unmount())
  expect(frames.size).toBe(0)
  setReducedMotion(true)
  setReducedMotion(false)
  document.dispatchEvent(new Event('visibilitychange'))
  expect(frames.size).toBe(0)
})
