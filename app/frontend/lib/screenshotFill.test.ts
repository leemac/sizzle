import { expect, it } from 'vitest'
import { MAX_PDF_BYTES, mergeScreenshotFields, screenshotFiles, screenshotFilesError } from './screenshotFill'
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

  expect(screenshotFiles([png, svg, text], true)).toEqual([png])
  expect(screenshotFiles(null, true)).toEqual([])
})

it('accepts up to four screenshots or one PDF within the size limit', () => {
  const png = new File(['png'], 'shot.png', { type: 'image/png' })
  const pdf = new File(['%PDF-1.7'], 'recipe.pdf', { type: 'application/pdf' })
  const hugePdf = new File(['%PDF-1.7'], 'cookbook.pdf', { type: 'application/pdf' })
  Object.defineProperty(hugePdf, 'size', { value: MAX_PDF_BYTES + 1 })

  expect(screenshotFiles([png, pdf, new File(['hi'], 'notes.txt', { type: 'text/plain' })], true)).toEqual([png, pdf])
  expect(screenshotFilesError([pdf], true)).toBeNull()
  expect(screenshotFilesError([png, png, png, png], true)).toBeNull()
  expect(screenshotFilesError([], true)).toContain('or a PDF')
  expect(screenshotFilesError([pdf, pdf], true)).toContain('one PDF')
  expect(screenshotFilesError([pdf, png], true)).toContain('one PDF')
  expect(screenshotFilesError([hugePdf], true)).toContain('10 MB')
  expect(screenshotFilesError([png, png, png, png, png], true)).toContain('up to 4')
})

it('drops PDFs and doesn’t mention them when the server has PDF uploads off', () => {
  const png = new File(['png'], 'shot.png', { type: 'image/png' })
  const pdf = new File(['%PDF-1.7'], 'recipe.pdf', { type: 'application/pdf' })

  expect(screenshotFiles([png, pdf], false)).toEqual([png])
  expect(screenshotFilesError([], false)).not.toContain('PDF')
})
