// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { readIngredientOrder, writeIngredientOrder } from './ingredientOrder'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

it('defaults to recipe order', () => {
  expect(readIngredientOrder()).toBe('recipe')
})

it('remembers the chosen order', () => {
  writeIngredientOrder('type')
  expect(readIngredientOrder()).toBe('type')
})

it('ignores values it does not know', () => {
  localStorage.setItem('sizzle:ingredient-order', 'alphabetical')
  expect(readIngredientOrder()).toBe('recipe')
})

it('survives storage methods that throw', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  expect(() => writeIngredientOrder('type')).not.toThrow()
  expect(readIngredientOrder()).toBe('recipe')
})
