// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { readGalleryLayout, writeGalleryLayout } from './galleryLayout'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

it('defaults to the grid', () => {
  expect(readGalleryLayout()).toBe('grid')
})

it('remembers the chosen layout', () => {
  writeGalleryLayout('list')
  expect(readGalleryLayout()).toBe('list')
})

it('ignores values it does not know', () => {
  localStorage.setItem('sizzle:gallery-layout', 'carousel')
  expect(readGalleryLayout()).toBe('grid')
})

it('survives storage methods that throw', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  expect(() => writeGalleryLayout('list')).not.toThrow()
  expect(readGalleryLayout()).toBe('grid')
})

it('survives a browser that throws on touching localStorage at all', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')!
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    },
  })
  try {
    expect(() => writeGalleryLayout('list')).not.toThrow()
    expect(readGalleryLayout()).toBe('grid')
  } finally {
    Object.defineProperty(globalThis, 'localStorage', original)
  }
})
