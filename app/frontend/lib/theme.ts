import { useSyncExternalStore, type CSSProperties } from 'react'
import type { ThemeMode, ThemeToken } from '@/types'

export const MODES: { value: ThemeMode; label: string; hint: string }[] = [
  { value: 'light', label: 'Light', hint: 'Always light' },
  { value: 'dark', label: 'Dark', hint: 'Always dark' },
  { value: 'auto', label: 'Auto', hint: 'Matches this device' },
]

/** Sets a theme's colours on one element, so Tailwind classes inside it (bg-paper, text-ink…) use that theme. */
export function themeStyle(tokens: Record<ThemeToken, string>): CSSProperties {
  return Object.fromEntries(Object.entries(tokens).map(([token, value]) => [`--color-${token}`, value]))
}

export function schemeFor(mode: ThemeMode, prefersDark: boolean): 'light' | 'dark' {
  if (mode === 'auto') return prefersDark ? 'dark' : 'light'
  return mode
}

/**
 * Shows a theme on the whole page. The server renders every theme's colours keyed
 * by these attributes (see Theme#css), so switching them restyles the page.
 */
export function applyAppearance(root: HTMLElement, theme: string, mode: ThemeMode) {
  root.dataset.theme = theme
  root.dataset.mode = mode
  const background = getComputedStyle(root).getPropertyValue('--color-porcelain').trim()
  if (!background) return
  root.ownerDocument.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute('content', background)
  })
}

type Look = { theme: string; mode: ThemeMode }
let saved: Look | null = null

/**
 * The look this browser has saved. It starts from the attributes the server rendered
 * and then follows server responses only: pages restored from history carry the props
 * they had back then, which may name an older look.
 */
export function savedLook(root: HTMLElement = document.documentElement): Look {
  saved ??= { theme: root.dataset.theme ?? '', mode: (root.dataset.mode as ThemeMode | undefined) ?? 'auto' }
  return saved
}

/** Records a look the server just confirmed and shows it. */
export function rememberLook({ theme, mode }: Look, root: HTMLElement = document.documentElement) {
  saved = { theme, mode }
  applyAppearance(root, theme, mode)
}

const darkQuery = '(prefers-color-scheme: dark)'

function subscribe(onChange: () => void) {
  const media = window.matchMedia(darkQuery)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

/** Whether this device currently prefers dark, kept up to date. */
export function usePrefersDark() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(darkQuery).matches,
    () => false,
  )
}
