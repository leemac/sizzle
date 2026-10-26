import { Link } from '@inertiajs/react'
import { useEffect, useState } from 'react'
import Icon from '@/components/Icon'

const STORAGE_KEY = 'sizzle:release-notes:seen'
// Keep the dot dismissed for this visit even when browser storage is unavailable.
let seenThisVisit: string | null = null

export default function ReleaseNotesLink({ latest, active }: { latest: string | null; active: boolean }) {
  const [unread, setUnread] = useState(false)

  useEffect(() => {
    if (active && latest) {
      seenThisVisit = latest
      try {
        window.localStorage.setItem(STORAGE_KEY, latest)
      } catch {
        // The in-memory fallback lasts until the next full page load.
      }
    }

    function sync() {
      let seen = seenThisVisit
      try {
        seen = window.localStorage.getItem(STORAGE_KEY) ?? seen
      } catch {
        // Private or restricted storage must not prevent reading the notes.
      }
      setUnread(!active && Boolean(latest && seen !== latest))
    }
    sync()
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) sync()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [latest, active])

  const label = unread ? "What's new — unread release notes" : "What's new"
  return (
    <Link
      href="/releases"
      aria-label={label}
      title={label}
      aria-current={active ? 'page' : undefined}
      className={`relative shrink-0 rounded-full p-2 hover:bg-paper hover:text-ink ${active ? 'text-ink' : 'text-graphite'}`}
    >
      <Icon name="journal" className="size-5" />
      {unread && (
        <span
          aria-hidden="true"
          className="absolute top-1 right-1 size-1.5 rounded-full bg-active ring-2 ring-porcelain"
        />
      )}
    </Link>
  )
}
