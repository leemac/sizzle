import { Link, usePage } from '@inertiajs/react'
import { useState, type ReactNode } from 'react'
import { useWakeLock } from '@/lib/useWakeLock'

export default function CookingMode({ children }: { children: ReactNode }) {
  const { preferences } = usePage().props
  const [cooking, setCooking] = useState(false)

  return (
    <div className="cooking-view mt-10" data-cooking={cooking} data-text-size={preferences.text_size}>
      <div className="no-print flex flex-wrap items-center justify-between gap-4 border-t border-hairline pt-6">
        <button
          type="button"
          aria-pressed={cooking}
          onClick={() => setCooking(!cooking)}
          className={`min-h-11 rounded-full px-5 py-3 text-sm font-semibold ${cooking ? 'bg-active text-on-active' : 'bg-paper ring-1 ring-hairline hover:ring-ink/30'}`}
        >
          {cooking ? 'Done cooking' : 'Start cooking'}
        </button>
        <Link href="/settings#cooking" className="py-2 text-sm text-graphite underline underline-offset-4">
          Cooking preferences
        </Link>
      </div>
      {cooking && <CookingStatus keepAwake={preferences.keep_awake === 'on'} />}
      {children}
    </div>
  )
}

function CookingStatus({ keepAwake }: { keepAwake: boolean }) {
  const awake = useWakeLock(keepAwake)
  return (
    <p role="status" className="no-print mt-3 text-sm text-graphite">
      {awake === 'active'
        ? 'Your screen will stay awake while this page is visible.'
        : awake === 'unavailable'
          ? 'Your browser couldn’t keep the screen awake. You may need to wake it manually.'
          : 'Cooking mode is on.'}
    </p>
  )
}
