import { describe, expect, it } from 'vitest'
import { formatAmount, formatMinutes, formatQuantity, groupBySection } from './format'

describe('formatMinutes', () => {
  it('formats minutes and hours', () => {
    expect(formatMinutes(30)).toBe('30 min')
    expect(formatMinutes(60)).toBe('1 hr')
    expect(formatMinutes(95)).toBe('1 hr 35 min')
  })

  it('returns null for missing or zero values', () => {
    expect(formatMinutes(null)).toBeNull()
    expect(formatMinutes(0)).toBeNull()
  })
})

describe('formatQuantity', () => {
  it('uses kitchen fractions', () => {
    expect(formatQuantity(1.5)).toBe('1½')
    expect(formatQuantity(0.333)).toBe('⅓')
    expect(formatQuantity(0.25)).toBe('¼')
  })

  it('keeps whole numbers and odd decimals readable', () => {
    expect(formatQuantity(2)).toBe('2')
    expect(formatQuantity(2.4)).toBe('2.4')
    expect(formatQuantity(1.99)).toBe('2')
  })
})

describe('formatAmount', () => {
  const base = { section: null, item: 'flour', preparation: null, note: null }

  it('joins quantity, range and unit', () => {
    expect(formatAmount({ ...base, quantity: 1.5, quantity_max: null, unit: 'cup' })).toBe('1½ cups')
    expect(formatAmount({ ...base, quantity: 2, quantity_max: 3, unit: null })).toBe('2–3')
    expect(formatAmount({ ...base, quantity: null, quantity_max: null, unit: null })).toBe('')
    expect(formatAmount({ ...base, quantity: 3, quantity_max: 4, unit: 'clove' })).toBe('3–4 cloves')
    expect(formatAmount({ ...base, quantity: 2, quantity_max: null, unit: 'tbsp' })).toBe('2 tbsp')
    expect(formatAmount({ ...base, quantity: 1, quantity_max: null, unit: 'pinch' })).toBe('1 pinch')
  })
})

describe('groupBySection', () => {
  it('groups in order of first appearance', () => {
    const groups = groupBySection([
      { section: null, text: 'a' },
      { section: 'Sauce', text: 'b' },
      { section: null, text: 'c' },
    ])
    expect(groups).toEqual([
      [
        null,
        [
          { section: null, text: 'a' },
          { section: null, text: 'c' },
        ],
      ],
      ['Sauce', [{ section: 'Sauce', text: 'b' }]],
    ])
  })
})
