import { describe, expect, it } from 'vitest'
import { formatAmount, formatDay, formatMinutes, formatQuantity, groupBySection, isToday, timeAgo } from './format'

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

const now = new Date(2026, 9, 24, 9, 30)
const iso = (year: number, month: number, day: number, hour = 12, minute = 0) =>
  new Date(year, month, day, hour, minute).toISOString()

describe('formatDay', () => {
  it('says today and yesterday by calendar day, not by 24 hours', () => {
    expect(formatDay(iso(2026, 9, 24, 0, 5), now)).toBe('Today')
    expect(formatDay(iso(2026, 9, 23, 23, 55), now)).toBe('Yesterday')
  })

  it('drops the year only within the current year', () => {
    expect(formatDay(iso(2026, 9, 3), now)).toBe('Oct 3')
    expect(formatDay(iso(2025, 11, 31), now)).toBe('Dec 31, 2025')
  })
})

describe('isToday', () => {
  it('is true from midnight to midnight', () => {
    expect(isToday(iso(2026, 9, 24, 0, 5), now)).toBe(true)
    expect(isToday(iso(2026, 9, 23, 23, 55), now)).toBe(false)
  })
})

const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000).toISOString()

describe('timeAgo', () => {
  it('counts up from minutes to years', () => {
    expect(timeAgo(ago(20), now)).toBe('Just now')
    expect(timeAgo(ago(60), now)).toBe('1 minute ago')
    expect(timeAgo(ago(5 * 60), now)).toBe('5 minutes ago')
    expect(timeAgo(ago(3 * 3600), now)).toBe('3 hours ago')
    expect(timeAgo(ago(3 * 86_400), now)).toBe('3 days ago')
    expect(timeAgo(ago(65 * 86_400), now)).toBe('2 months ago')
    expect(timeAgo(ago(400 * 86_400), now)).toBe('1 year ago')
  })

  it("doesn't show future times from a fast clock", () => {
    expect(timeAgo(ago(-30), now)).toBe('Just now')
  })
})
