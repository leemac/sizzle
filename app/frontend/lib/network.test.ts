import { expect, it } from 'vitest'
import { isTailscaleHost } from './network'

it('recognises Tailscale addresses and MagicDNS names', () => {
  expect(isTailscaleHost('100.64.0.1')).toBe(true)
  expect(isTailscaleHost('100.127.255.254')).toBe(true)
  expect(isTailscaleHost('cookbook.tail1234.ts.net')).toBe(true)
})

it('ignores other hosts', () => {
  expect(isTailscaleHost('100.63.0.1')).toBe(false)
  expect(isTailscaleHost('100.128.0.1')).toBe(false)
  expect(isTailscaleHost('192.168.1.20')).toBe(false)
  expect(isTailscaleHost('localhost')).toBe(false)
  expect(isTailscaleHost('ts.net.example.com')).toBe(false)
  expect(isTailscaleHost('100.64.0')).toBe(false)
})
