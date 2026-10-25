// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import LayoutToggle from './LayoutToggle'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

it('marks the current layout and reports the one chosen', () => {
  const onChange = vi.fn<(layout: string) => void>()
  act(() => root.render(<LayoutToggle value="grid" onChange={onChange} />))

  const grid = container.querySelector<HTMLButtonElement>('[aria-label="Show as grid"]')!
  const list = container.querySelector<HTMLButtonElement>('[aria-label="Show as list"]')!
  expect(grid.getAttribute('aria-pressed')).toBe('true')
  expect(list.getAttribute('aria-pressed')).toBe('false')

  act(() => list.click())
  expect(onChange).toHaveBeenCalledWith('list')
})
