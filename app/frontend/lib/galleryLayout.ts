import { useCallback, useState } from 'react'

export type GalleryLayout = 'grid' | 'list'

const KEY = 'sizzle:gallery-layout'
const LAYOUTS: readonly GalleryLayout[] = ['grid', 'list']

// Touching localStorage at all can throw when the browser blocks site data,
// so every access stays inside a try.

/** The layout this browser last chose. Falls back to the grid if storage is empty, blocked or holds junk. */
export function readGalleryLayout(): GalleryLayout {
  try {
    const stored = globalThis.localStorage?.getItem(KEY)
    return LAYOUTS.find((layout) => layout === stored) ?? 'grid'
  } catch {
    return 'grid'
  }
}

export function writeGalleryLayout(layout: GalleryLayout) {
  try {
    globalThis.localStorage?.setItem(KEY, layout)
  } catch {
    // Private windows and blocked storage: the choice just won't stick.
  }
}

/** Grid or list for the gallery, remembered per browser. */
export function useGalleryLayout(): [GalleryLayout, (layout: GalleryLayout) => void] {
  const [layout, setLayout] = useState(() => readGalleryLayout())
  const choose = useCallback((next: GalleryLayout) => {
    setLayout(next)
    writeGalleryLayout(next)
  }, [])
  return [layout, choose]
}
