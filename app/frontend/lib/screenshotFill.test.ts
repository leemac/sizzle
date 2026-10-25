import { expect, it } from 'vitest'
import { mergeScreenshotFields, screenshotFiles } from './screenshotFill'
import type { ManualRecipeInput } from '@/types'

const empty: ManualRecipeInput = {
  title: '',
  description: '',
  ingredients: '',
  steps: '',
  servings: '',
  prep_minutes: '',
  cook_minutes: '',
  source_url: 'https://example.com/blocked',
  meal_times: [],
  seasons: [],
}

it('fills empty fields from the screenshot', () => {
  const { data, filled, kept } = mergeScreenshotFields(empty, {
    title: 'Coconut rice',
    ingredients: '1 cup rice',
    servings: '4',
    prep_minutes: '',
    meal_times: ['dinner'],
    seasons: [],
  })

  expect(data).toEqual({
    ...empty,
    title: 'Coconut rice',
    ingredients: '1 cup rice',
    servings: '4',
    meal_times: ['dinner'],
  })
  expect(filled).toBe(4)
  expect(kept).toBe(0)
})

it('never overwrites what someone already typed', () => {
  const current = { ...empty, title: 'My rice', steps: 'Rinse.', meal_times: ['lunch' as const] }
  const { data, filled, kept } = mergeScreenshotFields(current, {
    title: 'Coconut rice',
    steps: 'Rinse.',
    ingredients: '1 cup rice',
    meal_times: ['dinner'],
  })

  expect(data).toEqual({ ...current, ingredients: '1 cup rice' })
  expect(filled).toBe(1)
  expect(kept).toBe(2)
})

it('treats whitespace as empty and ignores unknown fields', () => {
  const found = { title: 'Rice', source_url: 'https://evil.example', extra: 'x' } as never
  const { data, filled } = mergeScreenshotFields({ ...empty, title: '  ', source_url: '' }, found)

  expect(data.title).toBe('Rice')
  expect(data.source_url).toBe('')
  expect(data).not.toHaveProperty('extra')
  expect(filled).toBe(1)
})

it('picks out only image files from a paste or drop', () => {
  const png = new File(['png'], 'shot.png', { type: 'image/png' })
  const svg = new File(['<svg/>'], 'shot.svg', { type: 'image/svg+xml' })
  const text = new File(['hi'], 'notes.txt', { type: 'text/plain' })

  expect(screenshotFiles([png, svg, text])).toEqual([png])
  expect(screenshotFiles(null)).toEqual([])
})
