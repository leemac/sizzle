// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { fitToPage, largestFit, PRINT_AREA } from './print'

describe('largestFit', () => {
  const sizes = { min: 7, max: 11.5, step: 0.25 }

  it('finds the largest size that fits', () => {
    expect(largestFit((size) => size <= 9.3, sizes)).toEqual({ size: 9.25, fits: true })
    expect(largestFit((size) => size <= 7, sizes)).toEqual({ size: 7, fits: true })
  })

  it('uses the largest size when everything fits', () => {
    expect(largestFit(() => true, sizes)).toEqual({ size: 11.5, fits: true })
  })

  it('falls back to the smallest size when nothing fits', () => {
    expect(largestFit(() => false, sizes)).toEqual({ size: 7, fits: false })
  })

  it('tries only a handful of sizes', () => {
    const tried: number[] = []
    largestFit((size) => {
      tried.push(size)
      return size <= 10
    }, sizes)
    expect(tried.length).toBeLessThanOrEqual(6)
  })
})

// jsdom has no layout, so pretend height grows with the type size, at a rate set per layout.
// Moving the tips makes no difference unless a test says otherwise.
function sheetWithHeight(pixelsPerPoint: Record<string, number>) {
  const sheet = document.createElement('div')
  const rate = (layout: string) => pixelsPerPoint[layout] ?? pixelsPerPoint.split
  Object.defineProperty(sheet, 'scrollHeight', {
    get: () => parseFloat(sheet.style.getPropertyValue('--print-size')) * rate(sheet.dataset.layout ?? ''),
  })
  return sheet
}

const sizeOf = (sheet: HTMLElement) => sheet.style.getPropertyValue('--print-size')

describe('fitToPage', () => {
  it('picks the largest type that stays on one page', () => {
    const sheet = sheetWithHeight({ split: PRINT_AREA.height / 10, stacked: PRINT_AREA.height / 11 })
    fitToPage(sheet)
    expect(sheet.dataset.layout).toBe('split')
    expect(sizeOf(sheet)).toBe('9.75pt')
    expect(sheet.dataset.fit).toBe('page')
  })

  it('moves the tips under the method when that allows larger type', () => {
    const sheet = sheetWithHeight({ split: PRINT_AREA.height / 10, 'split-tips-right': PRINT_AREA.height / 11 })
    fitToPage(sheet)
    expect(sheet.dataset.layout).toBe('split-tips-right')
    expect(sizeOf(sheet)).toBe('10.75pt')
  })

  it('switches to a denser layout when the first one needs small type', () => {
    const sheet = sheetWithHeight({ split: PRINT_AREA.height / 8, stacked: PRINT_AREA.height / 10 })
    fitToPage(sheet)
    expect(sheet.dataset.layout).toBe('stacked')
    expect(sizeOf(sheet)).toBe('9.75pt')
  })

  it('keeps the first layout when a denser one is no better', () => {
    const sheet = sheetWithHeight({ split: PRINT_AREA.height / 8, stacked: PRINT_AREA.height / 7.5 })
    fitToPage(sheet)
    expect(sheet.dataset.layout).toBe('split')
    expect(sizeOf(sheet)).toBe('7.75pt')
  })

  it('marks a sheet that cannot fit so it can flow onto more pages, in the densest layout', () => {
    const sheet = sheetWithHeight({ split: PRINT_AREA.height / 5, stacked: PRINT_AREA.height / 6 })
    fitToPage(sheet)
    expect(sheet.dataset.layout).toBe('stacked')
    expect(sizeOf(sheet)).toBe('7pt')
    expect(sheet.dataset.fit).toBe('overflow')
  })
})
