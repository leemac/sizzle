import type { ThemeColors, ThemeToken } from '@/types'

// The same pairs test/models/theme_test.rb checks for built-in themes (WCAG 2.2 AA):
// text needs 4.5:1, an icon 3:1.
export const CONTRAST_CHECKS: { label: string; foreground: ThemeToken; background: ThemeToken; minimum: number }[] = [
  { label: 'Text on the page', foreground: 'ink', background: 'porcelain', minimum: 4.5 },
  { label: 'Text on cards', foreground: 'ink', background: 'paper', minimum: 4.5 },
  { label: 'Secondary text on the page', foreground: 'graphite', background: 'porcelain', minimum: 4.5 },
  { label: 'Secondary text on cards', foreground: 'graphite', background: 'paper', minimum: 4.5 },
  { label: 'Button label', foreground: 'on-action', background: 'action', minimum: 4.5 },
  { label: 'Selected label', foreground: 'on-active', background: 'active', minimum: 4.5 },
  { label: 'Highlighted text', foreground: 'ink', background: 'mark', minimum: 4.5 },
  { label: 'Heart on cards', foreground: 'accent', background: 'paper', minimum: 3 },
  { label: 'Errors on the page', foreground: 'danger', background: 'porcelain', minimum: 4.5 },
  { label: 'Errors on cards', foreground: 'danger', background: 'paper', minimum: 4.5 },
  { label: 'Delete button label', foreground: 'on-danger', background: 'danger', minimum: 4.5 },
]

function luminance(hex: string) {
  const [red, green, blue] = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

/** WCAG contrast ratio between two #rrggbb colours, from 1 to 21. */
export function contrast(first: string, second: string) {
  const [a, b] = [luminance(first), luminance(second)]
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/** The pairs in a palette that are too hard to read. */
export function contrastProblems(colors: ThemeColors) {
  return CONTRAST_CHECKS.map((check) => ({
    ...check,
    ratio: contrast(colors[check.foreground], colors[check.background]),
  })).filter((check) => check.ratio < check.minimum)
}
