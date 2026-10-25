// Open the share instructions for the device you're reading them on. iPadOS reports a Mac, so computers start on
// the iPhone instructions too: most people set up sharing for their phone.
export function detectPlatform(userAgent: string): 'ios' | 'android' {
  if (/android/i.test(userAgent)) return 'android'
  return 'ios'
}
