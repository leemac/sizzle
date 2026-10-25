import { useForm, usePoll } from '@inertiajs/react'
import { useEffect, useRef } from 'react'
import FieldError from '@/components/FieldError'
import type { CookbookImportSettings, CookbookImportStatus } from '@/types'

/**
 * Upload a cookbook export from another Sizzle server. Off unless the server sets
 * SIZZLE_COOKBOOK_IMPORT; the import runs in the background and this polls for progress.
 */
export default function CookbookImportForm({
  settings,
  buttonClass,
}: {
  settings: CookbookImportSettings
  buttonClass: string
}) {
  const form = useForm<{ archive: File | null }>({ archive: null })
  const input = useRef<HTMLInputElement>(null)
  const busy = settings.latest?.in_progress ?? false
  const { start, stop } = usePoll(2000, { only: ['instance'] }, { autoStart: false })

  useEffect(() => {
    if (busy) start()
    else stop()
    return stop
  }, [busy, start, stop])

  if (!settings.enabled) {
    return (
      <p className="text-sm text-graphite">
        To import a cookbook exported from another Sizzle server, set{' '}
        <code className="rounded bg-paper px-1.5 py-0.5 text-ink">SIZZLE_COOKBOOK_IMPORT=true</code> on this server and
        restart it.
      </p>
    )
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        form.post('/settings/import', {
          forceFormData: true,
          preserveScroll: true,
          onSuccess: () => {
            form.reset()
            if (input.current) input.current.value = ''
          },
        })
      }}
    >
      <label htmlFor="archive" className="text-sm font-medium">
        Cookbook export
      </label>
      <p id="archive-help" className="mt-1 text-sm text-graphite">
        A .tar.gz file from Download cookbook, up to {settings.max_mib} MB. Recipes already in this cookbook are
        skipped, so importing the same file twice is safe.
      </p>
      <input
        ref={input}
        id="archive"
        name="archive"
        type="file"
        accept=".gz,.tgz,application/gzip"
        aria-describedby={`archive-help${form.errors.archive ? ' archive-error' : ''}`}
        aria-invalid={!!form.errors.archive}
        disabled={busy || form.processing}
        onChange={(event) => form.setData('archive', event.target.files?.[0] ?? null)}
        className="mt-3 block w-full max-w-md text-sm text-graphite file:mr-3 file:rounded-full file:border-0 file:bg-paper file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink file:ring-1 file:ring-hairline hover:file:ring-ink/30"
      />
      <FieldError name="archive" error={form.errors.archive} />
      <button
        type="submit"
        disabled={!form.data.archive || form.processing || busy}
        className={`${buttonClass} mt-4 disabled:opacity-50`}
      >
        {form.processing ? 'Uploading…' : 'Import cookbook'}
      </button>
      {settings.latest && <ImportStatus status={settings.latest} />}
    </form>
  )
}

const recipes = (count: number) => `${count} ${count === 1 ? 'recipe' : 'recipes'}`

function ImportStatus({ status }: { status: CookbookImportStatus }) {
  const summary = [
    status.in_progress
      ? `${recipes(status.imported_count)} added so far.`
      : `Imported ${recipes(status.imported_count)}.`,
    status.skipped_count ? `Skipped ${status.skipped_count} already in your cookbook.` : '',
    status.rejected_count
      ? `${recipes(status.rejected_count)} couldn’t be read and ${status.rejected_count === 1 ? 'was' : 'were'} left out.`
      : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div role="status" aria-live="polite" className="mt-4 rounded-photo bg-paper p-4 text-sm ring-1 ring-hairline">
      {status.in_progress ? (
        <p>
          <span className="font-medium">Importing your cookbook…</span> {summary}
        </p>
      ) : status.stalled ? (
        <p className="text-danger">
          The last import stopped without finishing. Import the same file again to add the rest.
        </p>
      ) : status.status === 'failed' ? (
        <>
          <p className="text-danger">{status.error ?? 'The cookbook couldn’t be imported.'}</p>
          {status.imported_count > 0 && <p className="mt-1 text-graphite">{summary}</p>}
        </>
      ) : (
        <p>{summary}</p>
      )}
    </div>
  )
}
