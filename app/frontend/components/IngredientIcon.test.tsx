// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import IngredientIcon from './IngredientIcon'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

it('draws the matching icon, hidden from screen readers', () => {
  act(() => root.render(<IngredientIcon item="2 cloves garlic" className="size-5 text-graphite" />))
  const svg = container.querySelector('svg')!
  expect(svg.getAttribute('data-ingredient-icon')).toBe('garlic')
  expect(svg.getAttribute('aria-hidden')).toBe('true')
  expect(svg.getAttribute('stroke')).toBe('currentColor')
  expect(svg.getAttribute('class')).toBe('size-5 text-graphite')
})

it('shows a quiet dot when no icon fits', () => {
  act(() => root.render(<IngredientIcon item="dried culinary hibiscus" />))
  expect(container.querySelector('svg')).toBeNull()
  const dot = container.querySelector('[data-ingredient-icon="none"]')!
  expect(dot.getAttribute('aria-hidden')).toBe('true')
})
