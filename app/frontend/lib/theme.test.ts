// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { applyAppearance, applyCustomThemes, rememberLook, savedLook, schemeFor, themeStyle } from './theme'

describe('applyCustomThemes', () => {
  afterEach(() => {
    document.head.innerHTML = ''
  })

  it('replaces the server-rendered custom theme CSS with the latest', () => {
    document.head.innerHTML = '<style id="sizzle-custom-themes">:root[data-theme=custom-1]{}</style>'

    applyCustomThemes(':root[data-theme=custom-2]{--color-action:#5b2a86}')

    expect(document.querySelectorAll('#sizzle-custom-themes')).toHaveLength(1)
    expect(document.getElementById('sizzle-custom-themes')?.textContent).toContain('custom-2')
  })

  it('adds the tag when the page has none', () => {
    applyCustomThemes(':root[data-theme=custom-3]{}')

    expect(document.getElementById('sizzle-custom-themes')?.textContent).toBe(':root[data-theme=custom-3]{}')
  })
})

describe('schemeFor', () => {
  it('uses the chosen mode, or the device preference for auto', () => {
    expect(schemeFor('light', true)).toBe('light')
    expect(schemeFor('dark', false)).toBe('dark')
    expect(schemeFor('auto', true)).toBe('dark')
    expect(schemeFor('auto', false)).toBe('light')
  })
})

describe('themeStyle', () => {
  it('turns tokens into the CSS variables Tailwind reads', () => {
    expect(themeStyle({ paper: '#ffffff', 'on-action': '#18181b' } as never)).toEqual({
      '--color-paper': '#ffffff',
      '--color-on-action': '#18181b',
    })
  })
})

describe('applyAppearance', () => {
  afterEach(() => {
    document.head.innerHTML = ''
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('data-mode')
  })

  it('switches the attributes the theme stylesheet keys on', () => {
    applyAppearance(document.documentElement, 'pesto', 'dark')

    expect(document.documentElement.dataset.theme).toBe('pesto')
    expect(document.documentElement.dataset.mode).toBe('dark')
  })

  it("matches the browser bar to the theme's background", () => {
    document.head.innerHTML =
      '<style>:root[data-theme=pesto]{--color-porcelain:#f4f5f1}</style><meta name="theme-color" content="#000000">'

    applyAppearance(document.documentElement, 'pesto', 'light')

    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#f4f5f1')
  })
})

describe('savedLook', () => {
  it('starts from the server-rendered attributes and ignores later previews', () => {
    const root = document.createElement('html')
    root.dataset.theme = 'squid-ink'
    root.dataset.mode = 'light'

    expect(savedLook(root)).toEqual({ theme: 'squid-ink', mode: 'light' })
    applyAppearance(root, 'pesto', 'dark')
    expect(savedLook(root)).toEqual({ theme: 'squid-ink', mode: 'light' })
  })

  it('follows looks the server confirms', () => {
    const root = document.createElement('html')

    rememberLook({ theme: 'beet-it', mode: 'auto' }, root)

    expect(savedLook(root)).toEqual({ theme: 'beet-it', mode: 'auto' })
    expect(root.dataset.theme).toBe('beet-it')
  })
})
