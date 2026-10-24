import { useForm, usePage } from '@inertiajs/react'
import { useRef } from 'react'

export default function UrlImportForm() {
  const { app } = usePage().props
  const form = useForm({ url: '' })
  const submitting = useRef(false)

  const submit = (value: string) => {
    if (submitting.current) return

    const url = value.trim()
    try {
      const parsed = new URL(url)
      if (!['http:', 'https:'].includes(parsed.protocol) || /\s/.test(url)) throw new Error()
    } catch {
      form.setError('url', 'Paste a complete recipe URL starting with https:// or http://.')
      return
    }

    submitting.current = true
    form.transform(() => ({ url }))
    form.post('/imports', {
      preserveScroll: true,
      onSuccess: () => form.reset(),
      onFinish: () => {
        submitting.current = false
      },
    })
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        submit(form.data.url)
      }}
      className="mb-8 rounded-photo bg-paper p-4 ring-1 ring-hairline sm:p-5"
      aria-label="Add a recipe from a URL"
    >
      <label htmlFor="recipe-url" className="block font-medium">
        Add a recipe
      </label>
      <p id="recipe-url-help" className="mt-1 text-sm text-graphite">
        Paste a recipe link to import it automatically, or type a URL and press Import.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          id="recipe-url"
          name="url"
          type="url"
          required
          maxLength={2048}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="https://…"
          value={form.data.url}
          readOnly={form.processing}
          aria-invalid={!!form.errors.url}
          aria-describedby={`recipe-url-help${form.errors.url ? ' recipe-url-error' : ''}`}
          onChange={(event) => {
            form.setData('url', event.target.value)
            form.clearErrors('url')
          }}
          onPaste={(event) => {
            event.preventDefault()
            if (submitting.current) return
            const text = event.clipboardData.getData('text').trim()
            form.setData('url', text)
            form.clearErrors('url')
            submit(text)
          }}
          className="min-w-0 flex-1 rounded-full border-hairline bg-porcelain px-4 py-3 text-base placeholder:text-graphite focus:border-ink focus:ring-0"
        />
        <button
          type="submit"
          disabled={form.processing || form.data.url.trim() === ''}
          className="shrink-0 rounded-full bg-yolk px-5 py-3 text-sm font-semibold text-[#18181b] hover:brightness-95 disabled:opacity-50"
        >
          {form.processing ? 'Adding…' : 'Import'}
        </button>
      </div>
      {form.errors.url && (
        <p id="recipe-url-error" className="mt-2 text-sm text-danger" role="alert">
          {form.errors.url}
        </p>
      )}
      {!app.claude_configured && (
        <p className="mt-3 text-sm text-danger" role="alert">
          Imports need a Claude API key. Set ANTHROPIC_API_KEY in your environment and restart Sizzle.
        </p>
      )}
    </form>
  )
}
