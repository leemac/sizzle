// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { RECIPE_LINK_EXAMPLES, useRotatingPlaceholder } from './useRotatingPlaceholder'

let container: HTMLDivElement
let root: Root

function Field({ paused = false }: { paused?: boolean }) {
  const { placeholder, className } = useRotatingPlaceholder(['first…', 'second…', 'third…'], { paused })
  return <input placeholder={placeholder} className={className} />
}

const input = () => container.querySelector('input')!
const render = (paused = false) => act(() => root.render(<Field paused={paused} />))
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms))

function preferReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduce && query.includes('reduce') }))
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  preferReducedMotion(false)
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

it('fades to the next example and wraps around', () => {
  render()
  expect(input().placeholder).toBe('first…')

  wait(3500)
  expect(input().className).toContain('placeholder:opacity-0')
  wait(200)
  expect(input().placeholder).toBe('second…')
  expect(input().className).not.toContain('placeholder:opacity-0')

  wait(3700 * 2)
  expect(input().placeholder).toBe('first…')
})

it('holds still while paused', () => {
  render(true)
  wait(10_000)
  expect(input().placeholder).toBe('first…')

  render(false)
  wait(3700)
  expect(input().placeholder).toBe('second…')
})

it('shows the placeholder again when paused mid-fade', () => {
  render()
  wait(3550)
  expect(input().className).toContain('placeholder:opacity-0')

  render(true)
  expect(input().className).not.toContain('placeholder:opacity-0')
  wait(10_000)
  expect(input().placeholder).toBe('first…')
})

it('never changes for people who prefer reduced motion', () => {
  preferReducedMotion(true)
  render()
  wait(10_000)

  expect(input().placeholder).toBe('first…')
  expect(input().className).not.toContain('placeholder:opacity-0')
})

it('only uses reserved example domains', () => {
  for (const example of RECIPE_LINK_EXAMPLES) {
    expect(new URL(example).hostname).toMatch(/\.example$/)
    expect(example.endsWith('…')).toBe(true)
  }
})
