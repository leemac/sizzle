import type { ManualRecipeInput } from '@/types'

/** What the server read from a screenshot: the manual form's fields, minus the source link. */
export type ScreenshotFields = Omit<ManualRecipeInput, 'source_url'>

export const MAX_SCREENSHOTS = 4
export const SCREENSHOT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

const isBlank = (value: string | string[]) => (Array.isArray(value) ? value.length === 0 : value.trim() === '')

/**
 * Fills only the fields that are still empty, so a screenshot never overwrites what someone typed. `kept` counts
 * fields where the screenshot found something different from what was already there.
 */
export function mergeScreenshotFields(
  current: ManualRecipeInput,
  found: Partial<ScreenshotFields>,
): { data: ManualRecipeInput; filled: number; kept: number } {
  const data = { ...current }
  let filled = 0
  let kept = 0
  for (const name of Object.keys(found)) {
    // Only the form's own fields, and never the source link: a screenshot can't vouch for where it came from.
    if (!(name in current) || name === 'source_url') continue
    const key = name as keyof ScreenshotFields
    const value = found[key]
    if (value === undefined || value === null || isBlank(value)) continue
    if (isBlank(current[key])) {
      Object.assign(data, { [key]: value })
      filled += 1
    } else if (JSON.stringify(current[key]) !== JSON.stringify(value)) {
      kept += 1
    }
  }
  return { data, filled, kept }
}

/** The image files in a paste or drop, or none when it's text. */
export function screenshotFiles(files: FileList | File[] | null | undefined): File[] {
  return Array.from(files ?? []).filter((file) => SCREENSHOT_TYPES.includes(file.type))
}
