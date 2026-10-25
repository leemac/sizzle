import { Link, router, useForm, usePage, usePoll } from '@inertiajs/react'
import { useEffect, useRef, useState } from 'react'
import ImportStatusLabel from '@/components/ImportStatusLabel'
import ManualRecipeForm from '@/components/ManualRecipeForm'
import ImportDuplicateReview from '@/components/ImportDuplicateReview'
import Icon from '@/components/Icon'
import AppLayout from '@/layouts/AppLayout'
import { RECIPE_LINK_EXAMPLES, useRotatingPlaceholder } from '@/lib/useRotatingPlaceholder'
import { formatTimestamp, timeAgo } from '@/lib/format'
import type { Import, ImportReview, SourceDuplicate } from '@/types'

// With AI set up, the box also takes a pasted recipe, so the last example says so.
const LINK_OR_TEXT_EXAMPLES = [...RECIPE_LINK_EXAMPLES, 'Or paste the whole recipe…']

export default function ImportsIndex({
  imports,
  mode,
  source_url,
  duplicate_review,
  source_duplicate,
}: {
  imports: Import[]
  mode: 'import' | 'manual'
  source_url: string | null
  duplicate_review: ImportReview | null
  source_duplicate: SourceDuplicate | null
}) {
  const { app, preferences } = usePage().props
  const form = useForm({ input: '' })
  const input = useRef<HTMLTextAreaElement>(null)
  const [review, setReview] = useState(duplicate_review)
  const [submittedIds, setSubmittedIds] = useState<number[]>([])
  const [focused, setFocused] = useState(false)
  const example = useRotatingPlaceholder(app.claude_configured ? LINK_OR_TEXT_EXAMPLES : RECIPE_LINK_EXAMPLES, {
    paused: focused,
  })
  const { start, stop } = usePoll(2000, { only: ['imports'] }, { autoStart: false })
  const pending = imports.some((item) => item.status !== 'done' && item.status !== 'failed')
  const submitted = submittedIds
    .map((id) => imports.find((item) => item.id === id))
    .filter((item) => item !== undefined)
  const recent = imports.filter((item) => !submittedIds.includes(item.id)).slice(0, 3)
  const importingCount = submitted.filter((item) => item.status !== 'done' && item.status !== 'failed').length
  const savedCount = submitted.filter((item) => item.status === 'done').length
  const failedCount = submitted.filter((item) => item.status === 'failed').length
  const summary = [
    importingCount ? `${importingCount} importing` : '',
    savedCount ? `${savedCount} saved` : '',
    failedCount ? `${failedCount} ${failedCount === 1 ? 'needs' : 'need'} attention` : '',
  ]
    .filter(Boolean)
    .join(' · ')

  useEffect(() => {
    const first = document.getElementById(`import-${submittedIds[0]}`)
    if (!first) return
    const bounds = first.getBoundingClientRect()
    if (bounds.top < 80 || bounds.bottom > window.innerHeight - 24) {
      first.scrollIntoView({
        block: 'nearest',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      })
    }
  }, [submittedIds])

  useEffect(() => {
    if (pending) start()
    else stop()
    return stop
  }, [pending, start, stop])

  const send = (selected?: string[]) => {
    form.transform((data) => {
      const submission = { ...data, automatic_ai: preferences.ai_mode === 'automatic' }
      return review && selected ? { ...submission, review_token: review.token, selected_urls: selected } : submission
    })
    form.post('/imports', {
      preserveScroll: true,
      onSuccess: (page) => {
        const nextReview = page.props.duplicate_review as ImportReview | null
        setReview(nextReview)
        form.setDefaults({ input: '' })
        if (!nextReview) {
          form.setData('input', '')
          const ids = (page.props.submitted_import_ids ?? []) as number[]
          if (ids.length) setSubmittedIds((previous) => [...ids, ...previous.filter((id) => !ids.includes(id))])
        }
      },
    })
  }
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    send()
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">Add a recipe</h1>
      <p className="mt-3 text-graphite">Import a recipe link or write a recipe yourself.</p>

      <nav aria-label="Add recipe method" className="mt-8 flex gap-2">
        {(
          [
            ['import', 'Import a link'],
            ['manual', 'Write a recipe'],
          ] as const
        ).map(([value, label]) => (
          <Link
            key={value}
            href={value === 'manual' ? '/imports?mode=manual' : '/imports'}
            aria-current={mode === value ? 'page' : undefined}
            className={`rounded-full px-4 py-2 text-sm ${mode === value ? 'bg-active font-semibold text-on-active' : 'ring-1 ring-hairline hover:ring-ink/30'}`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {mode === 'manual' ? (
        <ManualRecipeForm sourceUrl={source_url} duplicate={source_duplicate} />
      ) : (
        <form onSubmit={submit} aria-busy={form.processing} className="mt-8">
          <p className="mb-4 text-sm text-graphite">
            Links with recipe data import directly, without AI.{' '}
            {app.claude_configured ? (
              'Claude extracts other pages and pasted recipe text automatically when needed.'
            ) : (
              <>
                For other pages or unstructured pasted text,{' '}
                <Link href="/imports?mode=manual" className="underline underline-offset-4">
                  write a recipe
                </Link>{' '}
                or{' '}
                <a
                  href="https://github.com/leemac/sizzle#install"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4"
                >
                  set up optional AI
                </a>
                .
              </>
            )}
          </p>
          <label htmlFor="input" className="text-sm font-medium">
            {app.claude_configured ? 'Recipe links or text' : 'Recipe links'}
          </label>
          <p id="input-help" className="mt-1 text-sm text-graphite">
            To import several recipes at once, paste one link per line (up to 20).
          </p>
          <textarea
            id="input"
            ref={input}
            aria-describedby={`input-help${form.errors.input ? ' input-error' : ''}`}
            aria-invalid={!!form.errors.input}
            rows={4}
            readOnly={form.processing}
            value={form.data.input}
            onChange={(event) => {
              form.setData('input', event.target.value)
              setReview(null)
            }}
            placeholder={example.placeholder}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className={`mt-2 w-full resize-y rounded-photo border-hairline bg-paper px-5 py-4 text-base placeholder:text-graphite focus:border-ink focus:ring-0 ${example.className}`}
          />
          {form.errors.input && (
            <p id="input-error" role="alert" className="mt-2 text-sm text-danger">
              {form.errors.input}
            </p>
          )}
          <div className="mt-4 flex items-center justify-between gap-4">
            <Link href="/share" className="text-sm text-graphite underline-offset-4 hover:text-ink hover:underline">
              Share straight from your phone instead
            </Link>
            <button
              type="submit"
              hidden={!!review}
              disabled={form.processing || form.data.input.trim() === ''}
              className="rounded-full bg-action px-6 py-3 font-semibold text-on-action hover:brightness-95 disabled:opacity-50"
            >
              {form.processing ? 'Adding…' : 'Import'}
            </button>
          </div>
        </form>
      )}

      {mode === 'import' && review && (
        <ImportDuplicateReview
          key={review.token}
          review={review}
          processing={form.processing}
          onConfirm={send}
          onCancel={() => {
            setReview(null)
            input.current?.focus()
          }}
        />
      )}

      {mode === 'import' && submitted.length > 0 && (
        <section aria-labelledby="submitted-heading" className="mt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="submitted-heading" className="font-display text-2xl font-semibold">
              Your imports
            </h2>
            <p role="status" aria-atomic="true" className="text-sm text-graphite">
              {summary}
            </p>
          </div>
          <ul className="mt-4 space-y-3">
            {submitted.map((item, index) => (
              <ImportRow key={item.id} item={item} fresh index={index} />
            ))}
          </ul>
        </section>
      )}

      {recent.length > 0 && (
        <section aria-labelledby="recent-heading" className="mt-12">
          <h2 id="recent-heading" className="font-display text-2xl font-semibold">
            Recent imports
          </h2>
          <ul className="mt-4 space-y-3">
            {recent.map((item) => (
              <ImportRow key={item.id} item={item} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

ImportsIndex.layout = AppLayout

function isYoutubeUrl(url: string | null) {
  if (!url) return false
  try {
    const { protocol, hostname } = new URL(url)
    return (
      ['http:', 'https:'].includes(protocol) &&
      (hostname === 'youtu.be' || hostname === 'youtube.com' || hostname.endsWith('.youtube.com'))
    )
  } catch {
    return false
  }
}

function ImportRow({ item, fresh = false, index = 0 }: { item: Import; fresh?: boolean; index?: number }) {
  const label = item.recipe_title ?? item.source_metadata?.title ?? item.url ?? item.text_preview ?? 'Pasted recipe'
  const [entranceDelay] = useState(() => Math.min(index, 4) * 45)
  const { preferences } = usePage().props
  const card = fresh || item.status === 'failed'

  return (
    <li
      id={`import-${item.id}`}
      className={`flex scroll-mt-24 items-start gap-4 ${card ? 'rounded-photo border border-hairline bg-paper p-4 sm:p-5' : 'py-4'} ${fresh ? 'import-card' : ''}`}
      style={fresh ? { animationDelay: `${entranceDelay}ms` } : undefined}
    >
      {item.status === 'done' && item.recipe_image_url ? (
        <ImportPhoto url={item.recipe_image_url} />
      ) : (
        card && (
          <span
            aria-hidden="true"
            className={`flex size-14 shrink-0 items-center justify-center rounded-photo ${item.status === 'failed' ? 'bg-porcelain text-danger' : 'bg-mark text-ink'}`}
          >
            {item.status === 'done' ? (
              <Icon key="saved" name="check" className="import-saved size-5" />
            ) : item.status === 'failed' ? (
              <Icon name={isYoutubeUrl(item.url) ? 'youtube' : 'link'} className="size-5" />
            ) : (
              <span className="flex gap-1">
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    className="import-dot size-1 rounded-full bg-ink"
                    style={{ animationDelay: `${dot * 140}ms` }}
                  />
                ))}
              </span>
            )}
          </span>
        )
      )}
      <div className="min-w-0 flex-1">
        {item.recipe_id ? (
          <Link href={`/recipes/${item.recipe_id}`} className="block truncate font-medium hover:underline">
            {label}
          </Link>
        ) : item.kind === 'url' && item.url && /^https?:\/\//i.test(item.url) ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="flex min-w-0 items-center gap-1.5 font-medium hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            <span className="truncate">{label}</span>
            <Icon name="external" className="size-4 shrink-0" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : (
          <p className="truncate font-medium">{label}</p>
        )}
        {item.source_metadata?.site_name && (
          <p className="mt-0.5 text-sm text-graphite">{item.source_metadata.site_name}</p>
        )}
        {item.source_metadata?.description && (
          <p className="mt-1 line-clamp-2 text-sm text-graphite">{item.source_metadata.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-2 text-sm text-graphite">
          <ImportStatusLabel status={item.status} showIndicator={!fresh} />
          {!fresh && (
            <>
              <span aria-hidden="true">·</span>
              <time dateTime={item.created_at} title={`Added ${formatTimestamp(item.created_at)}`}>
                {timeAgo(item.created_at)}
              </time>
            </>
          )}
        </div>
        {item.error && <p className="mt-1 text-sm text-graphite">{item.error}</p>}
        {item.status === 'failed' && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link
              href={item.kind === 'url' ? `/imports?mode=manual&from=${item.id}` : '/imports?mode=manual'}
              className="text-sm text-graphite underline underline-offset-4"
            >
              Write manually
            </Link>
            <button
              type="button"
              onClick={() =>
                router.post(
                  `/imports/${item.id}/retry`,
                  { automatic_ai: preferences.ai_mode === 'automatic' },
                  { preserveScroll: true },
                )
              }
              className="shrink-0 rounded-full px-4 py-1.5 text-sm ring-1 ring-hairline hover:ring-ink/30"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </li>
  )
}

function ImportPhoto({ url }: { url: string }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <span
      className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-photo bg-mark"
      aria-hidden="true"
    >
      <Icon name="check" className="size-5" />
      <img
        src={url}
        alt=""
        width={56}
        height={56}
        onLoad={() => setLoaded(true)}
        className={`absolute inset-0 size-full object-cover transition-opacity duration-300 motion-reduce:transition-none ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </span>
  )
}
