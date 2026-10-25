// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { router } from '@inertiajs/react'
import SosButton from './SosButton'

vi.mock('@inertiajs/react', () => ({ router: { get: vi.fn<() => void>() } }))
let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.useFakeTimers({ now: new Date(2026, 9, 25, 12, 30), toFake: ['Date'] })
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.clearAllMocks()
  vi.spyOn(Date.prototype, 'getTimezoneOffset').mockImplementation(function (this: Date) {
    return this.getMonth() === 0 ? 300 : 240
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const button = () => container.querySelector('button')!

it('shows recipes for the meal at this hour and this season', () => {
  act(() => root.render(<SosButton filters={{ q: 'soup', course: 'main' }} inGallery />))

  expect(button().textContent).toBe('What’s for lunch?')
  expect(button().getAttribute('aria-label')).toBe('What’s for lunch? Show lunch recipes for autumn')
  expect(button().getAttribute('aria-pressed')).toBe('false')
  act(() => button().click())
  expect(router.get).toHaveBeenCalledWith('/', { meal: 'lunch', season: 'autumn' }, expect.anything())
})

it('clears itself when pressed again', () => {
  act(() => root.render(<SosButton filters={{ meal: 'lunch', season: 'autumn' }} inGallery />))

  expect(button().getAttribute('aria-pressed')).toBe('true')
  act(() => button().click())
  expect(router.get).toHaveBeenCalledWith('/', {}, expect.anything())
})

it('opens the gallery as a new visit from another page', () => {
  act(() => root.render(<SosButton filters={{}} inGallery={false} />))

  act(() => button().click())
  expect(router.get).toHaveBeenCalledWith('/', { meal: 'lunch', season: 'autumn' }, {})
})
