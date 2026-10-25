import type { MealTime, Season } from '@/types'

export const MEAL_TIMES: MealTime[] = ['breakfast', 'lunch', 'dinner', 'snack']
export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter']

export type Hemisphere = 'north' | 'south'

/** The meal most people are thinking about at this hour, on the browser's own clock. */
export function mealTimeAt(date: Date): MealTime {
  const hour = date.getHours()
  if (hour >= 5 && hour < 11) return 'breakfast'
  if (hour >= 11 && hour < 15) return 'lunch'
  if (hour >= 17 && hour < 22) return 'dinner'
  return 'snack'
}

/** Meteorological seasons: March to May is spring in the north and autumn in the south. */
export function seasonAt(date: Date, hemisphere: Hemisphere): Season {
  const quarter = Math.floor(((date.getMonth() + 1) % 12) / 3)
  const north: Season[] = ['winter', 'spring', 'summer', 'autumn']
  return north[hemisphere === 'north' ? quarter : (quarter + 2) % 4]
}

/**
 * Clocks go forward in summer, so a time zone that is further ahead of UTC in
 * January than in July is in the southern hemisphere. Zones without daylight
 * saving can't tell, and fall back to the north.
 */
export function hemisphereAt(date: Date): Hemisphere {
  const year = date.getFullYear()
  const january = new Date(year, 0, 1).getTimezoneOffset()
  const july = new Date(year, 6, 1).getTimezoneOffset()
  return january < july ? 'south' : 'north'
}

export function currentMoment(date = new Date()): { meal: MealTime; season: Season } {
  return { meal: mealTimeAt(date), season: seasonAt(date, hemisphereAt(date)) }
}
