import { describe, expect, it } from 'vitest'
import { scaleIngredient } from './scaleIngredient'
import { formatAmount } from './format'
import type { Ingredient } from '@/types'

const plain = (item: string): Ingredient => ({
  item,
  section: 'Sauce',
  quantity: null,
  quantity_max: null,
  unit: null,
  preparation: null,
  note: null,
})

describe('scaleIngredient', () => {
  it('scales both ends of structured ranges without changing the original', () => {
    const ingredient = { ...plain('flour'), quantity: 1, quantity_max: 1.5, unit: 'cup', note: 'sifted' }
    const scaled = scaleIngredient(ingredient, 2)
    expect(formatAmount(scaled)).toBe('2–3 cups')
    expect(scaled.note).toBe('sifted')
    expect(scaled.section).toBe('Sauce')
    expect(ingredient.quantity).toBe(1)
    expect(formatAmount(scaleIngredient(ingredient, 0.5))).toBe('½–¾ cup')
  })

  it.each([
    ['1 cup flour', 2, '2 cups flour'],
    ['2 cups flour', 0.5, '1 cup flour'],
    ['1 1/2 tbsp oil', 2, '3 tbsp oil'],
    ['1/2 cup milk', 0.5, '¼ cup milk'],
    ['1½ cups milk', 2, '3 cups milk'],
    ['1 ½ cups milk', 2, '3 cups milk'],
    ['1 ¼ tsp salt', 2, '2½ tsp salt'],
    ['1\u00a0½ cups milk', 2, '3 cups milk'],
    ['1   ½ cups milk', 0.5, '¾ cup milk'],
    ['1 ½–2 ¼ cups milk', 2, '3–4½ cups milk'],
    ['½–1 ½ cups milk', 2, '1–3 cups milk'],
    ['½ tsp salt', 2, '1 tsp salt'],
    ['.5 cup milk', 2, '1 cup milk'],
    ['1.5 cups milk', 2, '3 cups milk'],
    ['2–3 cloves garlic', 0.5, '1–1½ cloves garlic'],
    ['1 - 2 tbsp oil', 2, '2–4 tbsp oil'],
    ['1 (400 g) can tomatoes', 2, '2 (400 g) can tomatoes'],
    ['1 cup flour (plus 2 tbsp for dusting)', 2, '2 cups flour (plus 2 tbsp for dusting)'],
    ['1 g saffron', 0.001, '0.001 g saffron'],
    ['400g tomatoes', 2, '800g tomatoes'],
    ['250ml milk', 0.5, '125ml milk'],
    ['0 g salt', 2, '0 g salt'],
  ])('scales %s by %s', (text, factor, expected) => {
    expect(scaleIngredient(plain(text), factor).item).toBe(expected)
  })

  it.each(['salt to taste', '2% milk', '1/0 cup flour', '#10 can tomatoes'])(
    'leaves ambiguous or unmeasured text alone: %s',
    (text) => {
      expect(scaleIngredient(plain(text), 2).item).toBe(text)
    },
  )

  it('keeps the exact original at the original servings and ignores invalid scale factors', () => {
    const ingredient = plain('1 1/2 cups flour')
    for (const factor of [1, 0, -1, NaN, Infinity]) expect(scaleIngredient(ingredient, factor)).toBe(ingredient)
  })
})
