import { useEffect, useState } from 'react'
import { currentMoment } from '@/lib/mealMoment'

const CHECK_MS = 60_000

// The meal and season right now, kept current while the page stays open: checked every minute and whenever the
// tab comes back, so a gallery opened before noon stops asking about breakfast at lunchtime.
export function useCurrentMoment() {
  const [moment, setMoment] = useState(currentMoment)

  useEffect(() => {
    const refresh = () =>
      setMoment((previous) => {
        const next = currentMoment()
        return next.meal === previous.meal && next.season === previous.season ? previous : next
      })
    const timer = window.setInterval(refresh, CHECK_MS)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  return moment
}
