import type { ImportStatus } from '@/types'

export const STATUS_TEXT: Record<ImportStatus, string> = {
  queued: 'Waiting to start',
  fetching: 'Reading the page',
  extracting: 'Writing up the recipe',
  saving: 'Saving photos',
  done: 'Saved',
  failed: 'Couldn’t import',
}

export default function ImportStatusLabel({
  status,
  showIndicator = true,
}: {
  status: ImportStatus
  showIndicator?: boolean
}) {
  const pending = status !== 'done' && status !== 'failed'
  const tone = status === 'failed' ? 'text-danger' : pending ? 'text-ink' : 'text-graphite'

  return (
    <span className={`inline-flex items-center gap-2 text-sm ${tone}`}>
      {pending && showIndicator && (
        <span className="size-2 motion-safe:animate-pulse rounded-full bg-active" aria-hidden="true" />
      )}
      {STATUS_TEXT[status]}
    </span>
  )
}
