import { describe, expect, it } from 'vitest'
import { contrast, contrastProblems } from './contrast'
import type { ThemeColors } from '@/types'

const readable: ThemeColors = {
  porcelain: '#f6f6f3',
  paper: '#ffffff',
  ink: '#18181b',
  graphite: '#6e6e73',
  hairline: '#e3e3de',
  action: '#ffc21a',
  'on-action': '#18181b',
  active: '#ffc21a',
  'on-active': '#18181b',
  mark: '#fff1c2',
  accent: '#a87300',
  danger: '#c0362c',
  'on-danger': '#ffffff',
}

describe('contrast', () => {
  it('matches the WCAG ratios', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21)
    expect(contrast('#ffffff', '#ffffff')).toBeCloseTo(1)
    expect(contrast('#767676', '#ffffff')).toBeCloseTo(4.54, 2)
  })
})

describe('contrastProblems', () => {
  it('passes a readable palette', () => {
    expect(contrastProblems(readable)).toEqual([])
  })

  it('names the pairs that are too faint, with the icon threshold for the heart', () => {
    const problems = contrastProblems({ ...readable, 'on-action': '#ffd75e', accent: '#ffc21a' })

    expect(problems.map((problem) => [problem.label, problem.minimum])).toEqual([
      ['Button label', 4.5],
      ['Heart on cards', 3],
    ])
  })
})
