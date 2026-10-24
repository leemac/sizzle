import { Head, Link, router, useForm, usePage, usePoll } from '@inertiajs/react'
import { useEffect } from 'react'
import ImportStatusLabel from '@/components/ImportStatusLabel'
import AppLayout from '@/layouts/AppLayout'
import type { Import } from '@/types'

export default function ImportsIndex({ imports }: { imports: Import[] }) {
  const { app } = usePage().props
  const form = useForm({ input: '' })
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
      <Head title="Add a recipe" />
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">Add a recipe</h1>
      <p className="mt-3 text-graphite">
        Paste a link to a recipe page, or the recipe text itself. Sizzle cleans it up and adds it to your cookbook.
      </p>

      {!app.claude_configured && (
        <p className="mt-6 rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          Imports need a Claude API key. Set ANTHROPIC_API_KEY in your environment and restart Sizzle.
        </p>
      )}

      <form onSubmit={submit} className="mt-8">
        <label htmlFor="input" className="sr-only">
          Recipe link or text
        </label>
        <textarea
          id="input"
          rows={3}
          value={form.data.input}
          onChange={(event) => form.setData('input', event.target.value)}
          placeholder="https://…"
          className="w-full resize-y rounded-photo border-hairline bg-paper px-5 py-4 text-base placeholder:text-graphite focus:border-ink focus:ring-0"
        />
        {form.errors.input && <p className="mt-2 text-sm text-danger">{form.errors.input}</p>}
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
        <button
          type="button"
          onClick={() => router.post(`/imports/${item.id}/retry`, {}, { preserveScroll: true })}
          className="shrink-0 rounded-full px-4 py-1.5 text-sm ring-1 ring-hairline hover:ring-ink/30"
        >
          Try again
        </button>
      )}
    </li>
  )
}
