import { useEffect, useState } from 'react'

/** Hold a screen wake lock only during cooking, releasing it on navigation. */
export function useWakeLock(enabled: boolean) {
  const [status, setStatus] = useState<'idle' | 'active' | 'unavailable'>('idle')
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator && window.isSecureContext

  useEffect(() => {
    if (!enabled || !supported) return
    let disposed = false
    let pending = false
    let lock: WakeLockSentinel | null = null

    const acquire = async () => {
      if (disposed || pending || lock || document.visibilityState !== 'visible') return
      pending = true
      try {
        const next = await navigator.wakeLock.request('screen')
        if (disposed || document.visibilityState !== 'visible') {
          await next.release()
          return
        }
        lock = next
        setStatus('active')
        next.addEventListener('release', () => {
          if (lock === next) lock = null
          if (!disposed) setStatus('unavailable')
        })
      } catch {
        if (!disposed) setStatus('unavailable')
      } finally {
        pending = false
      }
    }
    const visibility = () => {
      if (document.visibilityState === 'visible') void acquire()
      else if (lock) void lock.release().catch(() => {})
    }
    void acquire()
    document.addEventListener('visibilitychange', visibility)
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', visibility)
      if (lock) void lock.release().catch(() => {})
    }
  }, [enabled, supported])

  return enabled ? (supported ? status : 'unavailable') : 'idle'
}
