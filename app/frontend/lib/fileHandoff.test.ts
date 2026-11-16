import { expect, it } from 'vitest'
import { handOffFiles, takeHandedOffFiles } from './fileHandoff'

it('hands files over once', () => {
  const pdf = new File(['%PDF-'], 'card.pdf', { type: 'application/pdf' })
  handOffFiles([pdf])

  expect(takeHandedOffFiles()).toEqual([pdf])
  expect(takeHandedOffFiles()).toEqual([])
})

it('starts empty and keeps only the latest handoff', () => {
  expect(takeHandedOffFiles()).toEqual([])
  handOffFiles([new File(['a'], 'a.png', { type: 'image/png' })])
  const latest = new File(['b'], 'b.png', { type: 'image/png' })
  handOffFiles([latest])

  expect(takeHandedOffFiles()).toEqual([latest])
})
