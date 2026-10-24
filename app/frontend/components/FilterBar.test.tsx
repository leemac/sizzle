// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { router } from '@inertiajs/react'
import FilterBar from './FilterBar'
import type { Facets, RecipeFilters } from '@/types'

vi.mock('@inertiajs/react', () => ({ router: { get: vi.fn<() => void>() } }))
const facets: Facets = {
  courses: [{ value: 'main', count: 1 }],
  cuisines: [],
  diets: [],
  main_ingredients: [],
  max_minutes: [],
}
let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.clearAllMocks()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function render(filters: RecipeFilters) {
  act(() => root.render(<FilterBar filters={filters} facets={facets} />))
}

function typeQuery(value: string) {
  const input = container.querySelector('input')!
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function click(label: string) {
  const button = [...container.querySelectorAll('button')].find((element) => element.textContent === label)!
  act(() => button.click())
}

it('clears search and filters without restoring a previous filter after the debounce', () => {
  render({ q: 'curry', course: 'main' })
  typeQuery('pie')
  click('Clear')
  render({})
  act(() => vi.advanceTimersByTime(300))

  expect(container.querySelector('input')!.value).toBe('')
  expect(router.get).toHaveBeenCalledTimes(1)
  expect(router.get).toHaveBeenCalledWith('/', {}, expect.any(Object))
})

it('debounces typing and cancels the pending search when another filter applies', () => {
  render({})
  typeQuery('pie')
  act(() => vi.advanceTimersByTime(250))
  expect(router.get).toHaveBeenLastCalledWith('/', { q: 'pie' }, expect.any(Object))

  typeQuery('curry')
  click('main')
  act(() => vi.advanceTimersByTime(300))
  expect(router.get).toHaveBeenCalledTimes(2)
  expect(router.get).toHaveBeenLastCalledWith('/', { q: 'curry', course: 'main' }, expect.any(Object))
})

it('resets the search and cancels its debounce when returned filters clear the query', () => {
  render({ q: 'curry' })
  typeQuery('pie')
  render({})
  act(() => vi.advanceTimersByTime(300))

  expect(container.querySelector('input')!.value).toBe('')
  expect(router.get).not.toHaveBeenCalled()
  click('main')
  expect(router.get).toHaveBeenCalledExactlyOnceWith('/', { course: 'main' }, expect.any(Object))
})

it('preserves typing when polling returns the same search filter', () => {
  render({ q: 'curry' })
  typeQuery('pie')
  render({ q: 'curry' })
  act(() => vi.advanceTimersByTime(250))

  expect(container.querySelector('input')!.value).toBe('pie')
  expect(router.get).toHaveBeenCalledExactlyOnceWith('/', { q: 'pie' }, expect.any(Object))
})
