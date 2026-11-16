// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { router } from '@inertiajs/react'
import PasteBox, { pasteHint } from './PasteBox'
import { takeHandedOffFiles } from '@/lib/fileHandoff'

vi.mock('@inertiajs/react', () => ({
  router: { post: vi.fn<() => void>(), visit: vi.fn<() => void>() },
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

type Visit = {
  onStart?: () => void
  onError?: (errors: Record<string, string>) => void
  onSuccess?: (page: { component: string }) => void
  onFinish?: () => void
}

let container: HTMLDivElement
let root: Root
const pdf = new File(['%PDF-1.7'], 'card.pdf', { type: 'application/pdf' })

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.clearAllMocks()
  takeHandedOffFiles()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

const box = () => container.querySelector('textarea')!
const submitButton = () => container.querySelector<HTMLButtonElement>('button[type="submit"]')!

function render({ claudeConfigured = true, automaticAi = true } = {}) {
  act(() => root.render(<PasteBox claudeConfigured={claudeConfigured} automaticAi={automaticAi} />))
}

function type(value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!
  act(() => {
    setter.call(box(), value)
    box().dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function press(init: KeyboardEventInit & { isComposing?: boolean }) {
  const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...init })
  act(() => {
    box().dispatchEvent(event)
  })
  return event
}

// The last router.post, with a helper to play its callbacks the way Inertia would.
function lastPost() {
  const calls = vi.mocked(router.post).mock.calls
  const [url, data, options] = calls[calls.length - 1] as unknown as [string, Record<string, unknown>, Visit]
  return {
    url,
    data,
    respond(outcome: { errors?: Record<string, string>; component?: string }) {
      act(() => {
        options.onStart?.()
        if (outcome.errors) options.onError?.(outcome.errors)
        else options.onSuccess?.({ component: outcome.component ?? 'recipes/index' })
        options.onFinish?.()
      })
    },
  }
}

function paste(files: File[]) {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', { value: { files } })
  act(() => {
    box().dispatchEvent(event)
  })
  return event
}

it('Enter imports what was pasted and stays on the cookbook', () => {
  render()
  type('https://example.com/pie')

  const event = press({})

  expect(event.defaultPrevented).toBe(true)
  const post = lastPost()
  expect(post.url).toBe('/imports')
  expect(post.data).toEqual({ input: 'https://example.com/pie', automatic_ai: true, return_to: 'cookbook' })
})

it('Shift+Enter and Enter while composing add to the text instead of importing', () => {
  render()
  type('https://example.com/pie')

  expect(press({ shiftKey: true }).defaultPrevented).toBe(false)
  expect(press({ isComposing: true }).defaultPrevented).toBe(false)
  expect(router.post).not.toHaveBeenCalled()
})

it('does nothing with an empty box', () => {
  render()
  expect(submitButton().disabled).toBe(true)

  type('   ')
  press({})

  expect(submitButton().disabled).toBe(true)
  expect(router.post).not.toHaveBeenCalled()
})

it('passes on that AI is off in this browser', () => {
  render({ automaticAi: false })
  type('https://example.com/pie')
  press({})

  expect(lastPost().data.automatic_ai).toBe(false)
})

it('clears the box once the import is accepted', () => {
  render()
  type('https://example.com/pie')
  press({})

  lastPost().respond({})

  expect(box().value).toBe('')
  expect(container.querySelector('[role="alert"]')).toBeNull()
})

it('keeps the text and shows the error when the import is refused', () => {
  render()
  type('https://example.com:6379/pie')
  press({})

  lastPost().respond({ errors: { input: 'Input must be a public web link.' } })

  expect(box().value).toBe('https://example.com:6379/pie')
  expect(container.querySelector('[role="alert"]')?.textContent).toBe('Input must be a public web link.')
  expect(box().getAttribute('aria-invalid')).toBe('true')
  expect(box().getAttribute('aria-describedby')).toBe('paste-error')

  type('https://example.com/pie')
  expect(container.querySelector('[role="alert"]')).toBeNull()
})

it('leaves the text alone when a duplicate takes it to the import page', () => {
  render()
  type('https://example.com/pie')
  press({})

  lastPost().respond({ component: 'imports/index' })

  expect(box().value).toBe('https://example.com/pie')
})

it('counts a batch of links', () => {
  expect(pasteHint('https://example.com/pie')).toBeNull()
  expect(pasteHint('https://example.com/pie\nhttps://example.com/cake')).toBe('2 links · Enter imports them all')
  expect(pasteHint(Array.from({ length: 21 }, (_, i) => `https://example.com/${i}`).join('\n'))).toBe(
    '21 links · up to 20 at a time',
  )
  expect(pasteHint('Pancakes\n2 eggs')).toBe('Enter to import · Shift+Enter for a new line')
})

it('a pasted PDF opens Write a recipe with the file handed over', () => {
  render()

  const event = paste([pdf])

  expect(event.defaultPrevented).toBe(true)
  expect(router.visit).toHaveBeenCalledWith('/imports?mode=manual')
  expect(takeHandedOffFiles()).toEqual([pdf])
  expect(router.post).not.toHaveBeenCalled()
})

it('pasted text is left to the box', () => {
  render()

  const event = paste([])

  expect(event.defaultPrevented).toBe(false)
  expect(router.visit).not.toHaveBeenCalled()
})

it('refuses files Claude can’t take in one go, without leaving the page', () => {
  render()

  paste([pdf, new File(['png'], 'shot.png', { type: 'image/png' })])

  expect(router.visit).not.toHaveBeenCalled()
  expect(takeHandedOffFiles()).toEqual([])
  expect(container.querySelector('[role="alert"]')?.textContent).toBe('Add one PDF at a time, without screenshots.')
})

it('without Claude, a PDF points to writing the recipe instead', () => {
  render({ claudeConfigured: false })

  expect(container.querySelector('button[aria-label="Attach a PDF or screenshot"]')).toBeNull()
  paste([pdf])

  expect(router.visit).not.toHaveBeenCalled()
  expect(takeHandedOffFiles()).toEqual([])
  const alert = container.querySelector('[role="alert"]')!
  expect(alert.textContent).toBe('Reading a PDF or screenshot needs Claude. Write the recipe instead.')
  expect(alert.querySelector('a')?.getAttribute('href')).toBe('/imports?mode=manual')
})
