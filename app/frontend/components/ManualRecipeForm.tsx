import { useForm } from '@inertiajs/react'
import FieldError, { inputClass } from '@/components/FieldError'
import type { ManualRecipeInput } from '@/types'

export default function ManualRecipeForm({ sourceUrl }: { sourceUrl?: string | null }) {
  const form = useForm<ManualRecipeInput>({
    title: '',
    description: '',
    ingredients: '',
    steps: '',
    servings: '',
    prep_minutes: '',
    cook_minutes: '',
    source_url: sourceUrl ?? '',
  })

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    form.transform((data) => ({ manual_recipe: data }))
    form.post('/imports', { preserveScroll: 'errors' })
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-6">
      <p className="text-sm text-graphite">
        Write or paste your recipe into the fields below. No AI or API key needed.
      </p>
      <div>
        <label htmlFor="recipe-title" className="text-sm font-medium">
          Recipe title
        </label>
        <input
          id="recipe-title"
          required
          maxLength={300}
          value={form.data.title}
          onChange={(event) => form.setData('title', event.target.value)}
          className={inputClass}
          aria-invalid={!!form.errors.title}
          aria-describedby={form.errors.title ? 'title-error' : undefined}
        />
        <FieldError name="title" error={form.errors.title} />
      </div>
      <div>
        <label htmlFor="recipe-description" className="text-sm font-medium">
          Description <span className="font-normal text-graphite">(optional)</span>
        </label>
        <textarea
          id="recipe-description"
          rows={2}
          maxLength={2000}
          value={form.data.description}
          onChange={(event) => form.setData('description', event.target.value)}
          className={inputClass}
          aria-invalid={!!form.errors.description}
          aria-describedby={form.errors.description ? 'description-error' : undefined}
        />
        <FieldError name="description" error={form.errors.description} />
      </div>
      <div>
        <label htmlFor="recipe-source_url" className="text-sm font-medium">
          Source link <span className="font-normal text-graphite">(optional)</span>
        </label>
        <input
          id="recipe-source_url"
          type="url"
          inputMode="url"
          maxLength={2048}
          placeholder="https://…"
          value={form.data.source_url}
          onChange={(event) => form.setData('source_url', event.target.value)}
          className={`${inputClass} placeholder:text-graphite`}
          aria-invalid={!!form.errors.source_url}
          aria-describedby={form.errors.source_url ? 'source_url-error' : undefined}
        />
        <FieldError name="source_url" error={form.errors.source_url} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {(
          [
            ['servings', 'Servings', 1, 10000],
            ['prep_minutes', 'Prep (min)', 0, 525600],
            ['cook_minutes', 'Cook (min)', 0, 525600],
          ] as const
        ).map(([name, label, min, max]) => (
          <div key={name}>
            <label htmlFor={`recipe-${name}`} className="text-sm font-medium">
              {label}
            </label>
            <input
              id={`recipe-${name}`}
              type="number"
              min={min}
              max={max}
              step={1}
              value={form.data[name]}
              onChange={(event) => form.setData(name, event.target.value)}
              className={inputClass}
              aria-invalid={!!form.errors[name]}
              aria-describedby={form.errors[name] ? `${name}-error` : undefined}
            />
            <FieldError name={name} error={form.errors[name]} />
          </div>
        ))}
      </div>
      <p className="text-xs text-graphite">Servings and times are optional.</p>
      <div>
        <label htmlFor="recipe-ingredients" className="text-sm font-medium">
          Ingredients
        </label>
        <p id="ingredients-hint" className="mt-1 text-sm text-graphite">
          One ingredient per line, including quantities.
        </p>
        <textarea
          id="recipe-ingredients"
          rows={6}
          required
          maxLength={100000}
          value={form.data.ingredients}
          onChange={(event) => form.setData('ingredients', event.target.value)}
          className={inputClass}
          aria-invalid={!!form.errors.ingredients}
          aria-describedby={`ingredients-hint${form.errors.ingredients ? ' ingredients-error' : ''}`}
        />
        <FieldError name="ingredients" error={form.errors.ingredients} />
      </div>
      <div>
        <label htmlFor="recipe-steps" className="text-sm font-medium">
          Method
        </label>
        <p id="steps-hint" className="mt-1 text-sm text-graphite">
          One step per line.
        </p>
        <textarea
          id="recipe-steps"
          rows={6}
          required
          maxLength={100000}
          value={form.data.steps}
          onChange={(event) => form.setData('steps', event.target.value)}
          className={inputClass}
          aria-invalid={!!form.errors.steps}
          aria-describedby={`steps-hint${form.errors.steps ? ' steps-error' : ''}`}
        />
        <FieldError name="steps" error={form.errors.steps} />
      </div>
      <button
        type="submit"
        disabled={form.processing}
        className="rounded-full bg-action px-6 py-3 font-semibold text-on-action hover:brightness-95 disabled:opacity-50"
      >
        {form.processing ? 'Saving…' : 'Save recipe'}
      </button>
    </form>
  )
}
