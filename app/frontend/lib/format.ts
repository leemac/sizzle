import type { Ingredient } from '@/types'

/** 95 → "1 hr 35 min", 30 → "30 min". */
export function formatMinutes(minutes: number | null | undefined): string | null {
  if (minutes == null || minutes <= 0) return null
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`
}

const FRACTIONS: [number, string][] = [
  [1 / 8, '⅛'],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [3 / 8, '⅜'],
  [1 / 2, '½'],
  [5 / 8, '⅝'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
  [7 / 8, '⅞'],
]

/** 1.5 → "1½", 0.333 → "⅓", 2.4 → "2.4". Kitchen-friendly fractions where they fit. */
export function formatQuantity(value: number | null | undefined): string {
  if (value == null) return ''
  const whole = Math.floor(value)
  const fraction = value - whole
  if (fraction < 0.02) return String(whole)
  if (fraction > 0.98) return String(whole + 1)

  const match = FRACTIONS.find(([amount]) => Math.abs(amount - fraction) < 0.02)
  if (match) return whole === 0 ? match[1] : `${whole}${match[1]}`
  return String(Math.round(value * 100) / 100)
}

// Abbreviations read the same in the singular and plural ("2 tbsp", not "2 tbsps").
const INVARIANT_UNITS = new Set(['tsp', 'tbsp', 'fl oz', 'ml', 'l', 'g', 'kg', 'oz', 'lb', 'pinch of'])

/** "cup" → "cups" when the amount is more than one; abbreviations stay as they are. */
export function pluralizeUnit(unit: string, amount: number): string {
  if (amount <= 1 || INVARIANT_UNITS.has(unit.toLowerCase()) || unit.endsWith('s')) return unit
  if (/(ch|sh|x)$/.test(unit)) return `${unit}es`
  return `${unit}s`
}

/** The amount column for an ingredient line: "1½ cups", "2–3", "". */
export function formatAmount(ingredient: Ingredient): string {
  const { quantity, quantity_max, unit } = ingredient
  let amount = formatQuantity(quantity)
  if (quantity_max != null && quantity_max !== quantity) amount = `${amount}–${formatQuantity(quantity_max)}`
  const largest = Math.max(quantity ?? 0, quantity_max ?? 0)
  return [amount, unit && pluralizeUnit(unit, largest)].filter(Boolean).join(' ')
}

/** Groups items by their `section`, in the order each section first appears. */
export function groupBySection<T extends { section: string | null }>(items: T[]): [string | null, T[]][] {
  const groups = new Map<string | null, T[]>()
  for (const item of items) {
    const key = item.section?.trim() || null
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  return [...groups.entries()]
}
