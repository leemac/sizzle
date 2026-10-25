import { Link } from '@inertiajs/react'
import Icon from '@/components/Icon'

/**
 * Header indicator for imports that failed and haven't been dismissed: a quiet
 * icon with a count badge. Opens the imports page, where each one can be
 * retried, written manually or dismissed.
 */
export default function FailedImportsLink({ count }: { count: number }) {
  if (count <= 0) return null
  const label = `${count} failed ${count === 1 ? 'import' : 'imports'}`

  return (
    <Link
      href="/imports#needs-attention"
      aria-label={`${label}. Review imports`}
      title={label}
      className="relative shrink-0 rounded-full p-2 text-graphite hover:bg-paper hover:text-ink"
    >
      <Icon name="alert" className="size-5" />
      <span
        aria-hidden="true"
        className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[0.625rem] leading-none font-semibold text-on-danger tabular-nums ring-2 ring-porcelain"
      >
        {count > 9 ? '9+' : count}
      </span>
    </Link>
  )
}
