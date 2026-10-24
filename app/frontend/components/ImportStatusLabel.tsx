import type { ImportStatus } from '@/types'

export const STATUS_TEXT: Record<ImportStatus, string> = {
  queued: 'Waiting to start',
  fetching: 'Reading the page',
  extracting: 'Writing up the recipe',
  saving: 'Saving photos',
  done: 'Saved',
  failed: 'Couldn’t import',
}

export default function ImportStatusLabel({ status }: { status: ImportStatus }) {
  const pending = status !== 'done' && status !== 'failed'
  const tone = status === 'failed' ? 'text-danger' : pending ? 'text-ink' : 'text-graphite'

  return (
    <span className={`inline-flex items-center gap-2 text-sm ${tone}`}>
      {pending && <span className="size-2 animate-pulse rounded-full bg-yolk" aria-hidden="true" />}
      {STATUS_TEXT[status]}
    </span>
  )
}
