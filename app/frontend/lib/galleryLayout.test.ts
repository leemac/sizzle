// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest'
import { readGalleryLayout, writeGalleryLayout } from './galleryLayout'

beforeEach(() => localStorage.clear())

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

it('survives storage that throws', () => {
  const blocked = {
    getItem: () => {
      throw new Error('blocked')
    },
    setItem: () => {
      throw new Error('blocked')
    },
  } as unknown as Storage
  expect(() => writeGalleryLayout('list', blocked)).not.toThrow()
  expect(readGalleryLayout(blocked)).toBe('grid')
})
