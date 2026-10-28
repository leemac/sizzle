// @vitest-environment jsdom
import { act, type ComponentProps, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import WeeklyMenu from './show'

vi.mock('@inertiajs/react', () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}))
vi.mock('@/layouts/AppLayout', () => ({ default: () => null }))
vi.mock('@/components/WeeklyMenuPrint', () => ({ default: () => null }))

const currentKey = 'sizzle:menu:2026-10-25'
const pastKey = 'sizzle:menu:2026-10-18'
const recipes: ComponentProps<typeof WeeklyMenu>['recipes'] = [
  {
    id: 1,
    signature_keys: ['content:pancakes'],
    title: 'Pancakes',
    description: 'Fluffy pancakes.',
    meal_times: ['breakfast'],
    cooks_count: 3,
    cuisine: null,
    course: null,
    source_host: null,
    total_minutes: 20,
    favorite: true,
    image_url: null,
  },
]
const blank = () => ({
  days: Array.from({ length: 7 }, () => [] as { key: string; recipeId: number; meal: string }[]),
  notes: Array<string>(7).fill(''),
})
let container: HTMLDivElement
let root: Root
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 25, 12))
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  localStorage.clear()
  vi.restoreAllMocks()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
function render(items = recipes) {
  act(() => root.render(<WeeklyMenu recipes={items} />))
}
function button(name: string) {
  const element = [...container.querySelectorAll('button')].find(
    (candidate) => (candidate.getAttribute('aria-label') ?? candidate.textContent?.trim()) === name,
  )
  if (!element) throw Error(`Missing button: ${name}`)
  return element
}
function click(name: string) {
  act(() => button(name).click())
}
function select(label: string, value: string) {
  const element = container.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!
  act(() => {
    element.value = value
    element.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

it('adds from a meal filter into that meal, and undoes the addition in storage', () => {
  render()
  click('Breakfast')
  click('Add Pancakes to Sunday')
  expect(container.querySelector('section[aria-label="Sunday Breakfast"]')).not.toBeNull()
  expect(container.querySelector('section[aria-label="Sunday Dinner"]')).toBeNull()
  click('Undo last change')
  expect(JSON.parse(localStorage.getItem(currentKey)!).days[0]).toEqual([])
  expect(container.querySelector('section[aria-label="Sunday Breakfast"]')).toBeNull()
})

it('offers quick notes and restores the previous note with undo', () => {
  render()
  click('Add note for Sunday')
  click('Leftovers')
  expect(JSON.parse(localStorage.getItem(currentKey)!).notes[0]).toBe('Leftovers')
  click('Undo last change')
  expect(JSON.parse(localStorage.getItem(currentKey)!).notes[0]).toBe('')
})

it('requires replacement confirmation, copies independently, and can undo the copy', () => {
  const past = blank()
  past.days[0].push({ key: 'past-entry', recipeId: 1, meal: 'Breakfast' })
  past.notes[0] = 'Brunch'
  const current = blank()
  current.notes[2] = 'Eating out'
  localStorage.setItem(pastKey, JSON.stringify(past))
  localStorage.setItem(currentKey, JSON.stringify(current))
  render()
  select('Copy menu from week', pastKey)
  click('Copy menu')
  expect(JSON.parse(localStorage.getItem(currentKey)!)).toEqual(current)
  click('Cancel')
  expect(JSON.parse(localStorage.getItem(currentKey)!)).toEqual(current)
  click('Copy menu')
  click('Replace menu')
  const copied = JSON.parse(localStorage.getItem(currentKey)!)
  expect(copied.notes).toEqual(past.notes)
  expect(copied.days[0][0]).toMatchObject({ recipeId: 1, meal: 'Breakfast' })
  expect(copied.days[0][0].key).not.toBe('past-entry')
  expect(JSON.parse(localStorage.getItem(pastKey)!)).toEqual(past)
  click('Undo last change')
  expect(JSON.parse(localStorage.getItem(currentKey)!)).toEqual(current)
})

it('browses saved menus across the daylight-saving boundary and returns to this week', () => {
  const past = blank()
  past.notes[0] = 'Family lunch'
  localStorage.setItem('sizzle:menu:2026-11-1', JSON.stringify(past))
  localStorage.setItem('sizzle:menu:2026-11-8', JSON.stringify(past))
  localStorage.setItem('sizzle:menu:2026-10-26', JSON.stringify(past)) // Not a Sunday.
  localStorage.setItem('sizzle:menu:2026-10-11', '{"days":null}')
  render()
  select('View saved menu', 'sizzle:menu:2026-11-8')
  expect(container.querySelector<HTMLInputElement>('input[aria-label="Sunday note"]')?.value).toBe('Family lunch')
  expect(container.textContent).toContain('Nov 8')
  click('This week')
  expect(container.textContent).toContain('Oct 25')
  expect(container.querySelector('input[aria-label="Sunday note"]')).toBeNull()
  const options = [...container.querySelectorAll('select[aria-label="View saved menu"] option')].map((option) =>
    option.getAttribute('value'),
  )
  expect(options).not.toContain('sizzle:menu:2026-10-26')
  expect(options).not.toContain('sizzle:menu:2026-10-11')
})

it('keeps editing and undo available when storage cannot be written', () => {
  render()
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Blocked')
  })
  click('Add Pancakes to Sunday')
  expect(container.textContent).toContain('Browser storage is unavailable')
  expect(container.querySelector('section[aria-label="Sunday Dinner"]')).not.toBeNull()
  click('Undo last change')
  expect(container.querySelector('section[aria-label="Sunday Dinner"]')).toBeNull()
})

it('undoes a whole note edit rather than one character at a time', () => {
  render()
  click('Add note for Sunday')
  const input = container.querySelector<HTMLInputElement>('input[aria-label="Sunday note"]')!
  for (const value of ['Family', 'Family dinner']) {
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }
  act(() => input.blur())
  expect(JSON.parse(localStorage.getItem(currentKey)!).notes[0]).toBe('Family dinner')
  click('Undo last change')
  expect(JSON.parse(localStorage.getItem(currentKey)!).notes[0]).toBe('')
})

function dragEvent(element: Element, type: string, coordinates: { clientX?: number; clientY?: number } = {}) {
  act(() => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...coordinates })
    Object.defineProperty(event, 'dataTransfer', {
      value: { setData: vi.fn<(format: string, value: string) => void>(), effectAllowed: '', dropEffect: '' },
    })
    element.dispatchEvent(event)
  })
}

it('reveals only the fixed meal rails during a drag and clears them after cancelling', () => {
  render()
  const source = container.querySelector('article')!
  const sections = container.querySelectorAll('section').length
  dragEvent(source, 'dragstart')
  expect(container.querySelectorAll('[data-meal-drop]')).toHaveLength(28)
  expect(container.querySelectorAll('section')).toHaveLength(sections)
  expect(container.querySelector('section[aria-label="Sunday Breakfast"]')).toBeNull()
  dragEvent(source, 'dragend')
  expect(container.querySelectorAll('[data-meal-drop]')).toHaveLength(0)
  expect(localStorage.getItem(currentKey)).toBeNull()
})

it('maps the gap between meal targets to the adjacent meal instead of falling back to dinner', () => {
  render()
  dragEvent(container.querySelector('article')!, 'dragstart')
  const rail = container.querySelector('[aria-label="Meal targets for Sunday"]')!
  vi.spyOn(rail, 'getBoundingClientRect').mockReturnValue({ left: 100, width: 400 } as DOMRect)
  // The boundary between the first two columns belongs to Lunch.
  dragEvent(rail, 'dragover', { clientX: 200 })
  dragEvent(rail, 'drop', { clientX: 200 })
  expect(JSON.parse(localStorage.getItem(currentKey)!).days[0][0].meal).toBe('Lunch')
  expect(container.querySelectorAll('[data-meal-drop]')).toHaveLength(0)
})

it('uses the lower half of a recipe as an after target and the upper half as a before target', () => {
  const week = blank()
  week.days[0] = ['first', 'second', 'third'].map((key, index) => ({ key, recipeId: index + 1, meal: 'Dinner' }))
  localStorage.setItem(currentKey, JSON.stringify(week))
  render([
    recipes[0],
    { ...recipes[0], id: 2, signature_keys: ['content:toast'] },
    { ...recipes[0], id: 3, signature_keys: ['content:eggs'] },
  ])
  const dinner = container.querySelector('section[aria-label="Sunday Dinner"]')!
  const cards = () => [...dinner.querySelectorAll('article')]
  dragEvent(cards()[0], 'dragstart')
  const target = cards()[2]
  vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({ top: 100, height: 100 } as DOMRect)
  dragEvent(target, 'dragover', { clientY: 190 })
  dragEvent(target, 'drop', { clientY: 190 })
  expect(JSON.parse(localStorage.getItem(currentKey)!).days[0].map((entry: { key: string }) => entry.key)).toEqual([
    'second',
    'third',
    'first',
  ])
  dragEvent(cards()[2], 'dragstart')
  const first = cards()[0]
  vi.spyOn(first, 'getBoundingClientRect').mockReturnValue({ top: 100, height: 100 } as DOMRect)
  dragEvent(first, 'drop', { clientY: 110 })
  expect(JSON.parse(localStorage.getItem(currentKey)!).days[0].map((entry: { key: string }) => entry.key)).toEqual([
    'first',
    'second',
    'third',
  ])
})

it('does not add a recipe when dropped on the day header rather than a meal', () => {
  render()
  dragEvent(container.querySelector('article')!, 'dragstart')
  dragEvent(container.querySelector('section[aria-label="Sunday"]')!, 'drop')
  expect(localStorage.getItem(currentKey)).toBeNull()
  expect(container.querySelectorAll('[data-meal-drop]')).toHaveLength(0)
})

it('prevents repeat additions and matching recipe copies in the same meal', () => {
  render([...recipes, { ...recipes[0], id: 2, title: 'Pancakes copy' }])
  click('Add Pancakes to Sunday')
  click('Add Pancakes to Sunday')
  click('Add Pancakes copy to Sunday')
  expect(JSON.parse(localStorage.getItem(currentKey)!).days[0]).toHaveLength(1)
  expect(container.textContent).toContain('Already planned for Sunday dinner.')
  click('Undo last change')
  expect(JSON.parse(localStorage.getItem(currentKey)!).days[0]).toHaveLength(0)
})

it('allows the same recipe in different meals and days', () => {
  render()
  click('Add Pancakes to Sunday')
  click('Breakfast')
  click('Add Pancakes to Sunday')
  select('Add recipes to day', '1')
  click('Add Pancakes to Monday')
  const days = JSON.parse(localStorage.getItem(currentKey)!).days
  expect(days[0].map((entry: { meal: string }) => entry.meal)).toEqual(['Dinner', 'Breakfast'])
  expect(days[1]).toHaveLength(1)
})

it('rejects duplicate drops and preserves the source when a move would duplicate a meal', () => {
  const week = blank()
  week.days[0].push({ key: 'breakfast', recipeId: 1, meal: 'Breakfast' })
  week.days[1].push({ key: 'monday', recipeId: 1, meal: 'Lunch' })
  localStorage.setItem(currentKey, JSON.stringify(week))
  render()
  dragEvent(container.querySelector('article')!, 'dragstart')
  dragEvent(container.querySelector('section[aria-label="Sunday Breakfast"]')!, 'drop')
  expect(JSON.parse(localStorage.getItem(currentKey)!)).toEqual(week)
  dragEvent(container.querySelector('section[aria-label="Monday Lunch"] article')!, 'dragstart')
  dragEvent(container.querySelector('section[aria-label="Sunday Breakfast"]')!, 'drop')
  expect(JSON.parse(localStorage.getItem(currentKey)!)).toEqual(week)
  expect(container.textContent).toContain('Kept in its original place.')
})

it('cleans existing matching copies within a meal explicitly and can undo', () => {
  const week = blank()
  week.days[0] = [
    { key: 'first', recipeId: 1, meal: 'Breakfast' },
    { key: 'copy', recipeId: 2, meal: 'Breakfast' },
    { key: 'again', recipeId: 1, meal: 'Breakfast' },
    { key: 'dinner', recipeId: 1, meal: 'Dinner' },
  ]
  week.days[1].push({ key: 'monday', recipeId: 1, meal: 'Breakfast' })
  week.notes[0] = 'Family brunch'
  localStorage.setItem(currentKey, JSON.stringify(week))
  render([...recipes, { ...recipes[0], id: 2 }])
  expect(container.textContent).toContain('2 extra copies in the same meal.')
  expect(JSON.parse(localStorage.getItem(currentKey)!)).toEqual(week)
  click('Remove duplicates')
  const cleaned = JSON.parse(localStorage.getItem(currentKey)!)
  expect(cleaned.days[0].map((entry: { key: string }) => entry.key)).toEqual(['first', 'dinner'])
  expect(cleaned.days[1]).toEqual(week.days[1])
  expect(cleaned.notes).toEqual(week.notes)
  click('Undo last change')
  expect(JSON.parse(localStorage.getItem(currentKey)!)).toEqual(week)
})

it('copies a past menu with one copy per meal and leaves the original intact', () => {
  const past = blank()
  past.days[0] = ['first', 'copy'].map((key) => ({ key, recipeId: 1, meal: 'Breakfast' }))
  localStorage.setItem(pastKey, JSON.stringify(past))
  render()
  select('Copy menu from week', pastKey)
  click('Copy menu')
  expect(JSON.parse(localStorage.getItem(currentKey)!).days[0]).toHaveLength(1)
  expect(JSON.parse(localStorage.getItem(pastKey)!)).toEqual(past)
})
