// @vitest-environment jsdom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ReleaseNotesLink from './ReleaseNotesLink'

vi.mock('@inertiajs/react', () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
}))

let container: HTMLDivElement
let root: Root
const key = 'sizzle:release-notes:seen'

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear()
  container = document.createElement('div')
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function render(latest: string | null, active = false) {
  act(() => root.render(<ReleaseNotesLink latest={latest} active={active} />))
}

function unread() {
  return container.querySelector('a')?.getAttribute('aria-label')?.includes('unread')
}

it('clears the indicator only after visiting the notes, and shows it for a later release', () => {
  render('1.0.0')
  expect(unread()).toBe(true)
  expect(localStorage.getItem(key)).toBeNull()
  render('1.0.0', true)
  expect(unread()).toBe(false)
  expect(localStorage.getItem(key)).toBe('1.0.0')
  render('1.0.0')
  expect(unread()).toBe(false)
  render('1.1.0')
  expect(unread()).toBe(true)
})

it('respects a previous visit and changes from another tab', () => {
  localStorage.setItem(key, '2.0.0')
  render('2.0.0')
  expect(unread()).toBe(false)
  render('2.1.0')
  expect(unread()).toBe(true)
  act(() => {
    localStorage.setItem(key, '2.1.0')
    window.dispatchEvent(new StorageEvent('storage', { key }))
  })
  expect(unread()).toBe(false)
})

it('still opens and dismisses notes when browser storage is blocked', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Storage blocked')
  })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Storage blocked')
  })
  render('3.0.0')
  expect(unread()).toBe(true)
  render('3.0.0', true)
  expect(unread()).toBe(false)
  render('3.0.0')
  expect(unread()).toBe(false)
  expect(container.querySelector('a')?.getAttribute('href')).toBe('/releases')
})

it('does not signal updates when there are no notes for this build', () => {
  render(null)
  expect(unread()).toBe(false)
})

it('does not overwrite another tab’s newer read marker while older notes are open', () => {
  render('4.0.0', true)
  act(() => {
    localStorage.setItem(key, '4.1.0')
    window.dispatchEvent(new StorageEvent('storage', { key }))
  })
  expect(localStorage.getItem(key)).toBe('4.1.0')
  expect(unread()).toBe(false)
})
