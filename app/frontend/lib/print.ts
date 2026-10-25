/**
 * The area a printed recipe must fit, in CSS pixels: A4's width and US Letter's height,
 * each less half-inch margins, so one layout fits on either paper size.
 */
export const PRINT_AREA = { width: 7.25 * 96, height: 10 * 96 }

/**
 * Type sizes, in points, the printed sheet may use. Smaller type never makes the sheet taller.
 * Below `comfortable`, a denser layout is worth trying if it allows larger type.
 */
export const PRINT_SIZES = { min: 7, max: 11.5, step: 0.25, comfortable: 9 }

/**
 * Sheet layouts in tiers, most natural first. First, ingredients beside the method, with the
 * tips under either column. Then both stacked in columns across the page, which packs a long
 * ingredient list far better. A later tier is tried only if the earlier ones need small type.
 */
export const PRINT_LAYOUTS = [['split', 'split-tips-right'], ['stacked']]

/**
 * The largest size from `min` to `max` (in `step`s) for which `fits` holds, by binary search.
 * `fits` must be monotonic. When even `min` doesn't fit, returns `min` with `fits: false`.
 */
export function largestFit(
  fits: (size: number) => boolean,
  { min, max, step }: { min: number; max: number; step: number } = PRINT_SIZES,
): { size: number; fits: boolean } {
  const sizeAt = (n: number) => min + n * step
  let low = 0
  let high = Math.floor((max - min) / step)
  if (!fits(sizeAt(low))) return { size: min, fits: false }

  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (fits(sizeAt(middle))) low = middle
    else high = middle - 1
  }
  return { size: sizeAt(low), fits: true }
}

/**
 * Picks the layout and the largest `--print-size` that keep the sheet on one page, and
 * sets them as `data-layout` and `--print-size`. `data-fit` says whether it fit ("page")
 * or will run on ("overflow"). The sheet must be laid out at `PRINT_AREA.width`.
 */
export function fitToPage(sheet: HTMLElement, tiers: string[][] = PRINT_LAYOUTS): void {
  const setSize = (size: number) => sheet.style.setProperty('--print-size', `${size}pt`)
  // A little slack: print layout rounds glyphs and borders slightly differently from screen.
  const limit = PRINT_AREA.height * 0.98
  let best: { layout: string; size: number; fits: boolean } | null = null

  for (const tier of tiers) {
    for (const layout of tier) {
      sheet.dataset.layout = layout
      const result = largestFit((size) => {
        setSize(size)
        return sheet.scrollHeight <= limit
      })
      // A later layout wins when it fits and an earlier one didn't, or it allows larger type.
      if (!best || !best.fits || (result.fits && result.size > best.size)) best = { layout, ...result }
    }
    if (best?.fits && best.size >= PRINT_SIZES.comfortable) break
  }

  if (!best) return
  sheet.dataset.layout = best.layout
  setSize(best.size)
  sheet.dataset.fit = best.fits ? 'page' : 'overflow'
}
