// @vitest-environment jsdom
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import RecipeVideo, { videoTimestamp } from './RecipeVideo'

let container: HTMLDivElement
let root: Root
const watchUrl = 'https://www.youtube.com/watch?v=AbCdEfGhI_1'

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

function render(overrides: Partial<ComponentProps<typeof RecipeVideo>['recipe']> = {}) {
  act(() =>
    root.render(
      <RecipeVideo
        recipe={{
          youtube_url: watchUrl,
          youtube_duration_seconds: null,
          youtube_chapters: [],
          written_recipe_url: null,
          ...overrides,
        }}
      />,
    ),
  )
}

it('keeps the video link for existing recipes without metadata', () => {
  render()

  expect(container.querySelector('a')?.href).toBe(watchUrl)
  expect(container.textContent).toContain('Watch on YouTube')
  expect(container.querySelector('details')).toBeNull()
  expect(container.textContent).not.toContain('Written recipe')
  expect(container.textContent).not.toContain('0:00')
})

it('does not show a video card when the source is not YouTube', () => {
  render({ youtube_url: null })
  expect(container.textContent).toBe('')
})

it('shows duration, written recipe and timestamped chapters as external links', () => {
  render({
    youtube_duration_seconds: 3723,
    written_recipe_url: 'https://example.com/recipe',
    youtube_chapters: [{ title: 'Simmer <img src=x onerror=alert(1)>', start_seconds: 90, url: `${watchUrl}&t=90s` }],
  })

  expect(container.textContent).toContain('1:02:03 video')
  expect(container.querySelector('details')?.textContent).toContain('1:30Simmer <img src=x onerror=alert(1)>')
  expect(container.querySelector('img')).toBeNull()
  expect(container.querySelector('video, iframe')).toBeNull()
  const links = [...container.querySelectorAll('a')]
  expect(links.map((link) => link.href)).toEqual([watchUrl, 'https://example.com/recipe', `${watchUrl}&t=90s`])
  for (const link of links) {
    expect(link.target).toBe('_blank')
    expect(link.rel).toBe('noopener noreferrer nofollow')
  }
})

it.each([
  [0, '0:00'],
  [59, '0:59'],
  [60, '1:00'],
  [3599, '59:59'],
  [3600, '1:00:00'],
  [3723, '1:02:03'],
])('formats %i seconds as %s', (seconds, expected) => {
  expect(videoTimestamp(seconds)).toBe(expected)
})
