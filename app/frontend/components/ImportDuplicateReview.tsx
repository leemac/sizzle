import { Link } from '@inertiajs/react'
import { useEffect, useRef, useState } from 'react'
import type { ImportReview } from '@/types'

export default function ImportDuplicateReview({
  review,
  processing,
  onConfirm,
  onCancel,
}: {
  review: ImportReview
  processing: boolean
  onConfirm: (selected: string[]) => void
  onCancel: () => void
}) {
  const [selected, setSelected] = useState(
    review.entries.filter((entry) => !entry.recipe_id && !entry.pending_id).map((entry) => entry.key),
  )
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])
  const newCount = review.entries.filter(
    (entry) => !entry.recipe_id && !entry.pending_id && selected.includes(entry.key),
  ).length
  const restoreCount = review.entries.filter((entry) => entry.archived && selected.includes(entry.key)).length
  const label = [
    newCount > 0 ? `Import ${newCount} new ${newCount === 1 ? 'recipe' : 'recipes'}` : '',
    restoreCount > 0 ? `restore ${restoreCount} archived` : '',
  ]
    .filter(Boolean)
    .join(' and ')

  return (
    <section aria-labelledby="duplicate-heading" className="mt-8 rounded-photo border border-hairline p-5 sm:p-6">
      <h2 id="duplicate-heading" ref={heading} tabIndex={-1} className="font-display text-2xl font-semibold">
        Review duplicate links
      </h2>
      <p className="mt-2 text-sm text-graphite">
        Saved recipes and links already importing will be skipped. Repeated links import only once. Choose what to keep
        below.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onConfirm(selected)
        }}
      >
        <ul className="mt-4 divide-y divide-hairline">
          {review.entries.map((entry) => (
            <li key={entry.key} className="py-4">
              <p className="font-medium [overflow-wrap:anywhere]">{entry.recipe_title ?? entry.url}</p>
              {entry.recipe_title && <p className="mt-1 text-sm text-graphite [overflow-wrap:anywhere]">{entry.url}</p>}
              <p className="mt-1 text-sm text-graphite">
                {entry.recipe_id
                  ? entry.archived
                    ? 'Already saved · Archived'
                    : 'Already in your cookbook · Will be skipped'
                  : entry.pending_id
                    ? 'Already importing · Will be skipped'
                    : 'New link'}
                {entry.occurrences > 1 && ` · Included ${entry.occurrences} times`}
              </p>
              {entry.recipe_id ? (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                  <Link href={`/recipes/${entry.recipe_id}`} className="underline underline-offset-4">
                    Open saved recipe
                  </Link>
                  <Link href={`/recipes/${entry.recipe_id}/edit`} className="underline underline-offset-4">
                    Edit saved recipe
                  </Link>
                </div>
              ) : entry.pending_id ? (
                <Link
                  href={`/imports?current=${entry.pending_id}#import-${entry.pending_id}`}
                  className="mt-2 inline-block text-sm underline underline-offset-4"
                >
                  View current import
                </Link>
              ) : null}
              {(entry.archived || (!entry.recipe_id && !entry.pending_id)) && (
                <label className="mt-3 flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(entry.key)}
                    disabled={processing}
                    onChange={(event) =>
                      setSelected((keys) =>
                        event.target.checked ? [...keys, entry.key] : keys.filter((key) => key !== entry.key),
                      )
                    }
                    className="rounded border-hairline text-ink focus:ring-ink"
                  />
                  {entry.archived ? 'Restore to cookbook' : 'Import once'}
                  <span className="sr-only">: {entry.recipe_title ?? entry.url}</span>
                </label>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={processing}
            className="rounded-full bg-action px-5 py-3 font-semibold text-on-action hover:brightness-95 disabled:opacity-50"
          >
            {label ? label[0].toUpperCase() + label.slice(1) : 'Done — skip these links'}
          </button>
          <button
            type="button"
            disabled={processing}
            onClick={onCancel}
            className="rounded-full px-5 py-3 ring-1 ring-hairline hover:ring-ink/30 disabled:opacity-50"
          >
            Back to links
          </button>
        </div>
      </form>
    </section>
  )
}
