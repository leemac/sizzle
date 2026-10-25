// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { copyText } from './clipboard'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('uses the clipboard API in a secure context', async () => {
  const writeText = vi.fn<(value: string) => Promise<void>>().mockResolvedValue()
  vi.stubGlobal('isSecureContext', true)
  vi.stubGlobal('navigator', { clipboard: { writeText } })

  expect(await copyText('http://192.168.1.20/api/imports')).toBe(true)
  expect(writeText).toHaveBeenCalledWith('http://192.168.1.20/api/imports')
})

it('falls back to a hidden text field over plain HTTP', async () => {
  vi.stubGlobal('isSecureContext', false)
  let copied = ''
  document.execCommand = vi.fn<(command: string) => boolean>(() => {
    copied = document.querySelector('textarea')?.value ?? ''
    return true
  })

  expect(await copyText('http://192.168.1.20/api/imports')).toBe(true)
  expect(copied).toBe('http://192.168.1.20/api/imports')
  expect(document.querySelector('textarea')).toBeNull()
})

it('reports when nothing could be copied', async () => {
  vi.stubGlobal('isSecureContext', false)
  document.execCommand = vi.fn<(command: string) => boolean>(() => false)

  expect(await copyText('anything')).toBe(false)
})
