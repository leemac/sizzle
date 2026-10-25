// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Tabs from './Tabs'

const tabs = [
  { id: 'ios', label: 'iPhone and iPad', content: <p>iOS steps</p> },
  { id: 'android', label: 'Android', content: <p>Android steps</p> },
  { id: 'computer', label: 'Computer', content: <p>Computer steps</p> },
]
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

const render = (initial?: string) => act(() => root.render(<Tabs label="Share from" tabs={tabs} initial={initial} />))
const tab = (name: string) =>
  [...container.querySelectorAll<HTMLElement>('[role="tab"]')].find((node) => node.textContent === name)!
const panel = () => container.querySelector('[role="tabpanel"]')!
const press = (key: string) =>
  act(() => {
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  })

it('shows the first tab by default', () => {
  render()
  expect(tab('iPhone and iPad').getAttribute('aria-selected')).toBe('true')
  expect(panel().textContent).toBe('iOS steps')
})

it('starts on the initial tab', () => {
  render('android')
  expect(tab('Android').getAttribute('aria-selected')).toBe('true')
  expect(panel().textContent).toBe('Android steps')
  expect(panel().getAttribute('aria-labelledby')).toBe(tab('Android').id)
})

it('falls back to the first tab for an unknown initial tab', () => {
  render('windows-phone')
  expect(panel().textContent).toBe('iOS steps')
})

it('switches panels on click and keeps only the selected tab focusable', () => {
  render()
  act(() => tab('Computer').click())

  expect(panel().textContent).toBe('Computer steps')
  expect(tab('Computer').tabIndex).toBe(0)
  expect(tab('iPhone and iPad').tabIndex).toBe(-1)
})

it('moves between tabs with the arrow keys, Home and End', () => {
  render()
  act(() => tab('iPhone and iPad').focus())

  press('ArrowRight')
  expect(panel().textContent).toBe('Android steps')
  expect(document.activeElement).toBe(tab('Android'))

  press('ArrowLeft')
  press('ArrowLeft')
  expect(panel().textContent).toBe('Computer steps')

  press('Home')
  expect(panel().textContent).toBe('iOS steps')

  press('End')
  expect(document.activeElement).toBe(tab('Computer'))
})
