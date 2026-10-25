// @vitest-environment jsdom
import { act, type ComponentProps, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ShareShow from './show'

vi.mock('@inertiajs/react', () => ({
  Head: () => null,
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}))

let container: HTMLDivElement
let root: Root

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

function render(props: Partial<ComponentProps<typeof ShareShow>> = {}) {
  act(() =>
    root.render(
      <ShareShow
        endpoint="http://192.168.1.20:3000/api/imports"
        shortcut_endpoints={[{ url: 'http://192.168.1.20:3000/api/imports', network: null }]}
        token_required={false}
        {...props}
      />,
    ),
  )
}

const copyFields = () => [...container.querySelectorAll('code.select-all')].map((node) => node.textContent)

it('offers the address the page was opened with', () => {
  render()

  expect(copyFields()).toEqual(['http://192.168.1.20:3000/api/imports'])
  expect(container.textContent).toContain('Anyone who can reach this server can add recipes')
  expect(container.textContent).not.toContain('Authorization')
})

it('labels each network address when opened on the server itself', () => {
  render({
    endpoint: 'http://localhost:3000/api/imports',
    shortcut_endpoints: [
      { url: 'http://192.168.1.20:3000/api/imports', network: 'home' },
      { url: 'http://100.101.102.103:3000/api/imports', network: 'tailscale' },
    ],
  })

  expect(copyFields()).toEqual(['http://192.168.1.20:3000/api/imports', 'http://100.101.102.103:3000/api/imports'])
  expect(container.textContent).toContain('On your home Wi-Fi')
  expect(container.textContent).toContain('Tailscale is running on this server')
})

it('explains how to find the address when it can’t offer one', () => {
  render({ endpoint: 'http://localhost:3000/api/imports', shortcut_endpoints: [] })

  expect(copyFields()).toEqual([])
  expect(container.textContent).toContain('http://192.168.1.20:3000/api/imports')
  expect(container.textContent).toContain('which your phone can’t reach')
})

it('notices when the page was opened through Tailscale', () => {
  render({
    endpoint: 'http://cookbook.tail1234.ts.net/api/imports',
    shortcut_endpoints: [{ url: 'http://cookbook.tail1234.ts.net/api/imports', network: null }],
  })

  expect(container.textContent).toContain('You’re using Sizzle through Tailscale')
})

const showTab = (name: string) =>
  act(() =>
    [...container.querySelectorAll<HTMLElement>('[role="tab"]')].find((tab) => tab.textContent === name)!.click(),
  )
const panel = () => container.querySelector('[role="tabpanel"]')!

it('asks for the token header in every method when the API needs one', () => {
  render({ token_required: true })

  expect(container.textContent).toContain('Shares need your API token')
  expect(panel().textContent).toContain('Authorization')
  showTab('Android')
  expect(panel().textContent).toContain('Request Headers')
  expect(panel().textContent).toContain('401')
  showTab('Computer')
  expect(panel().querySelector('pre')?.textContent).toContain('Authorization: Bearer $SIZZLE_API_TOKEN')
})

it('leaves the token out when the API doesn’t need one', () => {
  render()

  expect(panel().textContent).not.toContain('Authorization')
  showTab('Android')
  expect(panel().textContent).not.toContain('Request Headers')
  showTab('Computer')
  expect(panel().querySelector('pre')?.textContent).not.toContain('Authorization')
})

it('starts on the iPhone steps and offers Android through HTTP Shortcuts', () => {
  render()
  expect(panel().textContent).toContain('Build the Shortcut')

  showTab('Android')
  expect(panel().textContent).toContain('Allow Receiving Value from Share Dialog')
  expect(panel().textContent).toContain('JSON encode')
  expect(panel().textContent).toContain('{"text": "{shared}"}')
  const play = [...panel().querySelectorAll('a')].find((link) => link.textContent === 'Google Play')
  expect(play?.getAttribute('href')).toBe('https://play.google.com/store/apps/details?id=ch.rmy.android.http_shortcuts')
})

it('starts on the Android steps on an Android phone', () => {
  vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/131.0 Mobile' })
  render()

  expect(panel().textContent).toContain('Set up HTTP Shortcuts')
})

it('links to Tailscale in a new tab', () => {
  render()

  const download = [...container.querySelectorAll('a')].find((link) => link.textContent === 'Get Tailscale')
  expect(download?.getAttribute('href')).toBe('https://tailscale.com/download')
  expect(download?.getAttribute('target')).toBe('_blank')
  expect(download?.getAttribute('rel')).toBe('noreferrer')
})
