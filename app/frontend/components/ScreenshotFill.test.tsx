// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ScreenshotFill from './ScreenshotFill'
import type { ScreenshotFields } from '@/lib/screenshotFill'

let container: HTMLDivElement
let root: Root
const png = new File(['png'], 'shot.png', { type: 'image/png' })

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

function render(
  onFields = vi.fn<(fields: Partial<ScreenshotFields>) => { filled: number; kept: number }>(() => ({
    filled: 3,
    kept: 1,
  })),
) {
  act(() => root.render(<ScreenshotFill onFields={onFields} />))
  return onFields
}

function paste(files: File[]) {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', { value: { files } })
  act(() => {
    document.dispatchEvent(event)
  })
  return event
}

function respond(status: number, body: unknown) {
  const fetch = vi.fn<(url: string, request: RequestInit) => Promise<Response>>(
    async () => new Response(JSON.stringify(body), { status }),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}

it('pasting a screenshot sends it with the CSRF token and fills the form', async () => {
  document.head.innerHTML = '<meta name="csrf-token" content="token-123">'
  const fetch = respond(200, { fields: { title: 'Coconut rice' } })
  const onFields = render()

  const event = paste([png])
  expect(event.defaultPrevented).toBe(true)
  expect(container.textContent).toContain('Reading your screenshot…')
  await act(async () => {})

  const [url, request] = fetch.mock.calls[0]
  expect(url).toBe('/imports/screenshots')
  expect((request.headers as Record<string, string>)['X-CSRF-Token']).toBe('token-123')
  expect((request.body as FormData).getAll('screenshots[]')).toHaveLength(1)
  expect(onFields).toHaveBeenCalledWith({ title: 'Coconut rice' })
  expect(container.textContent).toContain('Filled in 3 fields. Check them before saving.')
  expect(container.textContent).toContain('Kept 1 field you’d already filled in.')
})

it('pasting text is left alone', () => {
  const fetch = respond(200, {})
  render()

  const event = paste([new File(['hi'], 'notes.txt', { type: 'text/plain' })])

  expect(event.defaultPrevented).toBe(false)
  expect(fetch).not.toHaveBeenCalled()
})

it('shows the server’s error and keeps the form as it was', async () => {
  respond(422, { error: 'No recipe found in that screenshot.' })
  const onFields = render()

  paste([png])
  await act(async () => {})

  expect(onFields).not.toHaveBeenCalled()
  expect(container.querySelector('[role="alert"]')?.textContent).toBe('No recipe found in that screenshot.')
})

it('caps how many screenshots are sent at once', () => {
  const fetch = respond(200, {})
  render()

  paste(Array.from({ length: 5 }, () => png))

  expect(fetch).not.toHaveBeenCalled()
  expect(container.textContent).toContain('Add up to 4 screenshots at a time.')
})
