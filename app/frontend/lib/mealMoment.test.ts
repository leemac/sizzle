import { afterEach, expect, it, vi } from 'vitest'
import { currentMoment, hemisphereAt, mealTimeAt, seasonAt } from './mealMoment'

afterEach(() => vi.restoreAllMocks())

const at = (month: number, hour = 12) => new Date(2026, month, 15, hour, 30)

it('picks the meal from the hour of day', () => {
  expect(mealTimeAt(at(0, 5))).toBe('breakfast')
  expect(mealTimeAt(at(0, 10))).toBe('breakfast')
  expect(mealTimeAt(at(0, 11))).toBe('lunch')
  expect(mealTimeAt(at(0, 14))).toBe('lunch')
  expect(mealTimeAt(at(0, 15))).toBe('snack')
  expect(mealTimeAt(at(0, 17))).toBe('dinner')
  expect(mealTimeAt(at(0, 21))).toBe('dinner')
  expect(mealTimeAt(at(0, 23))).toBe('snack')
  expect(mealTimeAt(at(0, 2))).toBe('snack')
})

it('uses meteorological seasons in the north', () => {
  expect([0, 2, 5, 8, 11].map((month) => seasonAt(at(month), 'north'))).toEqual([
    'winter',
    'spring',
    'summer',
    'autumn',
    'winter',
  ])
})

it('flips the seasons in the south', () => {
  expect([0, 3, 6, 9].map((month) => seasonAt(at(month), 'south'))).toEqual(['summer', 'autumn', 'winter', 'spring'])
})

function mockOffsets(january: number, july: number) {
  vi.spyOn(Date.prototype, 'getTimezoneOffset').mockImplementation(function (this: Date) {
    return this.getMonth() === 0 ? january : july
  })
}

it('reads the hemisphere from when the clocks go forward', () => {
  mockOffsets(-660, -600) // Sydney: daylight saving in January
  expect(hemisphereAt(at(9))).toBe('south')
  mockOffsets(300, 240) // New York: daylight saving in July
  expect(hemisphereAt(at(9))).toBe('north')
})

it('falls back to the north without daylight saving', () => {
  mockOffsets(-330, -330)
  expect(hemisphereAt(at(9))).toBe('north')
})

it('combines meal and season for right now', () => {
  mockOffsets(-660, -600)
  expect(currentMoment(at(9, 12))).toEqual({ meal: 'lunch', season: 'spring' })
})
