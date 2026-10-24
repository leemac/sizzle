import { expect, it } from 'vitest'
import { detectPlatform } from './platform'

it('opens the Android instructions on Android', () => {
  expect(
    detectPlatform('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36'),
  ).toBe('android')
})

it('opens the iPhone instructions everywhere else', () => {
  expect(
    detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'),
  ).toBe('ios')
  expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15')).toBe(
    'ios',
  )
})
