import { formatQuantity, pluralizeUnit } from './format'
import type { Ingredient } from '@/types'

const FRACTIONS: Record<string, number> = {
  '⅛': 1 / 8,
  '¼': 1 / 4,
  '⅓': 1 / 3,
  '⅜': 3 / 8,
  '½': 1 / 2,
  '⅝': 5 / 8,
  '⅔': 2 / 3,
  '¾': 3 / 4,
  '⅞': 7 / 8,
}
const NUMBER = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d*[${Object.keys(FRACTIONS).join('')}]|\d+(?:\.\d+)?|\.\d+)`
const LEADING_AMOUNT = new RegExp(
  `^(${NUMBER})(?:\\s*[–—-]\\s*(${NUMBER}))?(?=\\s|$|(?:kg|mg|g|ml|l|oz|lb|tsp|tbsp)\\b)([\\s\\S]*)$`,
  'i',
)
const UNIT = /^(\s+)(cups?|teaspoons?|tablespoons?|pints?|quarts?|gallons?|ounces?|pounds?|cloves?|cans?)(?=\s|$)/i

function quantity(text: string): number {
  const glyph = FRACTIONS[text.slice(-1)]
  if (glyph) return Number(text.slice(0, -1)) + glyph
  if (text.includes('/')) {
    const parts = text.split(/[\s/]+/).map(Number)
    const denominator = parts.pop()!
    const numerator = parts.pop()!
    return denominator > 0 ? (parts[0] ?? 0) + numerator / denominator : NaN
  }
  return Number(text)
}

/** Scale structured amounts or a plain line's leading amount; leave package sizes and notes alone. */
export function scaleIngredient(ingredient: Ingredient, factor: number): Ingredient {
  if (!Number.isFinite(factor) || factor <= 0 || factor === 1) return ingredient
  if (ingredient.quantity != null || ingredient.quantity_max != null) {
    return {
      ...ingredient,
      quantity: ingredient.quantity == null ? null : ingredient.quantity * factor,
      quantity_max: ingredient.quantity_max == null ? null : ingredient.quantity_max * factor,
    }
  }

  const match = ingredient.item.match(LEADING_AMOUNT)
  if (!match) return ingredient
  const lower = quantity(match[1]) * factor
  const upper = match[2] ? quantity(match[2]) * factor : null
  if (!Number.isFinite(lower) || (upper != null && !Number.isFinite(upper))) return ingredient
  const amount = upper == null ? formatQuantity(lower) : `${formatQuantity(lower)}–${formatQuantity(upper)}`
  const rest = match[3].replace(
    UNIT,
    (_match, space: string, unit: string) =>
      space + pluralizeUnit(unit.replace(/s$/i, ''), Math.max(lower, upper ?? 0)),
  )
  return { ...ingredient, item: amount + rest }
}
