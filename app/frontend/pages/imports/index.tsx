import { Link, router, useForm, usePage, usePoll } from '@inertiajs/react'
import { useEffect, useState } from 'react'
import ImportStatusLabel from '@/components/ImportStatusLabel'
import ManualRecipeForm from '@/components/ManualRecipeForm'
import AppLayout from '@/layouts/AppLayout'
import { RECIPE_LINK_EXAMPLES, useRotatingPlaceholder } from '@/lib/useRotatingPlaceholder'
import type { Import } from '@/types'

// With AI set up, the box also takes a pasted recipe, so the last example says so.
const LINK_OR_TEXT_EXAMPLES = [...RECIPE_LINK_EXAMPLES, 'Or paste the whole recipe…']

export default function ImportsIndex({
  imports,
  mode,
  source_url,
}: {
  imports: Import[]
  mode: 'import' | 'manual'
  source_url: string | null
}) {
  const { app } = usePage().props
  const form = useForm({ input: '' })
  const [focused, setFocused] = useState(false)
  const example = useRotatingPlaceholder(app.claude_configured ? LINK_OR_TEXT_EXAMPLES : RECIPE_LINK_EXAMPLES, {
    paused: focused,
  })
  const { start, stop } = usePoll(2000, { only: ['imports'] }, { autoStart: false })
  const pending = imports.some((item) => item.status !== 'done' && item.status !== 'failed')

  useEffect(() => {
    if (pending) start()
    else stop()
    return stop
  }, [pending, start, stop])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    form.post('/imports', { preserveScroll: true, onSuccess: () => form.reset() })
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">Add a recipe</h1>
      <p className="mt-3 text-graphite">
        Import a recipe link or write a recipe yourself. Your cookbook works without AI.
      </p>

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
            className={`rounded-full px-4 py-2 text-sm ${mode === value ? 'bg-yolk font-semibold text-[#18181b]' : 'ring-1 ring-hairline hover:ring-ink/30'}`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {mode === 'manual' ? (
        <ManualRecipeForm sourceUrl={source_url} />
      ) : (
        <form onSubmit={submit} className="mt-8">
          <p className="mb-4 text-sm text-graphite">
            Links with recipe data import directly, without AI.{' '}
            {app.claude_configured ? (
              'Claude can extract other pages and pasted recipe text when needed.'
            ) : (
              <>
                For other pages or unstructured pasted text,{' '}
                <Link href="/imports?mode=manual" className="underline underline-offset-4">
                  write a recipe
                </Link>{' '}
                or{' '}
                <Link href="/setup?step=claude" className="underline underline-offset-4">
                  set up optional AI
                </Link>
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
            aria-describedby={`input-help${form.errors.input ? ' input-error' : ''}`}
            aria-invalid={!!form.errors.input}
            rows={4}
            value={form.data.input}
            onChange={(event) => form.setData('input', event.target.value)}
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
              disabled={form.processing || form.data.input.trim() === ''}
              className="rounded-full bg-yolk px-6 py-3 font-semibold text-[#18181b] hover:brightness-95 disabled:opacity-50"
            >
              Import
            </button>
          </div>
        </form>
      )}

      {imports.length > 0 && (
        <section className="mt-16">
          <h2 className="font-display text-2xl font-semibold">Recent imports</h2>
          <ul className="mt-4 divide-y divide-hairline">
            {imports.map((item) => (
              <ImportRow key={item.id} item={item} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

ImportsIndex.layout = AppLayout

function ImportRow({ item }: { item: Import }) {
  const label = item.recipe_title ?? item.url ?? item.text_preview ?? 'Pasted recipe'

  return (
    <li className="flex items-start justify-between gap-4 py-4">
      <div className="min-w-0">
        {item.recipe_id ? (
          <Link href={`/recipes/${item.recipe_id}`} className="block truncate font-medium hover:underline">
            {label}
          </Link>
        ) : (
          <p className="truncate font-medium">{label}</p>
        )}
        <ImportStatusLabel status={item.status} />
        {item.error && <p className="mt-1 text-sm text-graphite">{item.error}</p>}
      </div>
      {item.status === 'failed' && (
        <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
          <Link
            href={item.kind === 'url' ? `/imports?mode=manual&from=${item.id}` : '/imports?mode=manual'}
            className="text-sm text-graphite underline underline-offset-4"
          >
            Write manually
          </Link>
          <button
            type="button"
            onClick={() => router.post(`/imports/${item.id}/retry`, {}, { preserveScroll: true })}
            className="shrink-0 rounded-full px-4 py-1.5 text-sm ring-1 ring-hairline hover:ring-ink/30"
          >
            Try again
          </button>
        </div>
      )}
    </li>
  )
}
