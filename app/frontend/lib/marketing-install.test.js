// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import marketingPage from '../../../site/index.html?raw'

beforeEach(async () => {
  vi.resetModules()
  document.body.innerHTML = new DOMParser().parseFromString(marketingPage, 'text/html').body.innerHTML
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
  await import('../../../site/marketing.js')
})

afterEach(() => {
  document.body.innerHTML = ''
  delete navigator.clipboard
  vi.unstubAllGlobals()
})

it('copies each installation step separately without skipping token setup', async () => {
  const blocks = [...document.querySelectorAll('.code-block')]
  expect(blocks).toHaveLength(4)
  for (const block of blocks) {
    const button = block.querySelector('.copy-code')
    expect(button.hidden).toBe(false)
    button.click()
    await vi.waitFor(() => expect(block.querySelector('.copy-status').textContent).toBe('Commands copied.'))
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(block.querySelector('code').textContent)
  }
  const download = navigator.clipboard.writeText.mock.calls[1][0]
  expect(download).toContain('env.example')
  expect(download).not.toContain('docker compose up')
  expect(navigator.clipboard.writeText.mock.calls[2][0]).toBe('openssl rand -hex 32')
  expect(navigator.clipboard.writeText.mock.calls[3][0]).toBe('docker compose up -d --wait')
})

it('selects only the requested command when clipboard access is unavailable', async () => {
  navigator.clipboard.writeText.mockRejectedValue(new Error('Permission denied'))
  const block = document.querySelectorAll('.code-block')[3]
  block.querySelector('.copy-code').click()
  await vi.waitFor(() => expect(block.querySelector('.copy-status').textContent).toContain('Copy unavailable.'))
  expect(window.getSelection().toString()).toBe('docker compose up -d --wait')
  expect(document.activeElement).toBe(block.querySelector('pre'))
})

it('keeps the copied trial local, hardened and separate from the server cookbook', () => {
  const command = document.querySelector('#try pre code').textContent.replaceAll('\\\n', '')
  expect(command.match(/(?:^|\s)(?:-p|--publish)\s+\S+/g)).toEqual([' -p 127.0.0.1:3001:80'])
  expect(command).toContain('--read-only')
  expect(command).toContain('--security-opt no-new-privileges:true')
  expect(command).toContain('-v sizzle-try-storage:/rails/storage')
  expect(command).not.toMatch(/--privileged|--network[= ]host/)
})
