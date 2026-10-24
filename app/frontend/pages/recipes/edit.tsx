import { Link, useForm } from '@inertiajs/react'
import FieldError, { inputClass } from '@/components/FieldError'
import Icon from '@/components/Icon'
import AppLayout from '@/layouts/AppLayout'
import type { RecipeEditForm, RecipeEditInput } from '@/types'

type FieldName = keyof RecipeEditInput

export default function RecipeEdit({ recipe }: { recipe: RecipeEditForm }) {
  const form = useForm<RecipeEditInput>(recipe.fields)

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    form.transform((data) => ({ recipe: data }))
    form.patch(`/recipes/${recipe.id}`, { preserveScroll: 'errors' })
  }

  // Wires a field's id, value, change handler and error description together.
  const field = (name: FieldName, describedBy?: string) => ({
    id: `recipe-${name}`,
    value: form.data[name],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      form.setData(name, event.target.value),
    className: inputClass,
    'aria-invalid': !!form.errors[name],
    'aria-describedby': [describedBy, form.errors[name] && `${name}-error`].filter(Boolean).join(' ') || undefined,
  })

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/recipes/${recipe.id}`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-graphite hover:text-ink"
      >
        <Icon name="back" className="size-4" />
        Back to recipe
      </Link>
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">Edit recipe</h1>

      <form onSubmit={submit} className="mt-8 space-y-6">
        <div>
          <Label name="title">Recipe title</Label>
          <input required maxLength={300} {...field('title')} />
          <FieldError name="title" error={form.errors.title} />
        </div>
        <div>
          <Label name="description" optional>
            Description
          </Label>
          <textarea rows={3} maxLength={2000} {...field('description')} />
          <FieldError name="description" error={form.errors.description} />
        </div>
        <div>
          <Label name="source_url" optional>
            Source link
          </Label>
          <input type="url" inputMode="url" maxLength={2048} placeholder="https://…" {...field('source_url')} />
          <FieldError name="source_url" error={form.errors.source_url} />
        </div>

        <div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ['servings', 'Servings', 1, 10000],
                ['prep_minutes', 'Prep (min)', 0, 525600],
                ['cook_minutes', 'Cook (min)', 0, 525600],
                ['total_minutes', 'Total (min)', 0, 525600],
              ] as const
            ).map(([name, label, min, max]) => (
              <div key={name}>
                <Label name={name}>{label}</Label>
                <input type="number" min={min} max={max} step={1} {...field(name, 'times-hint')} />
                <FieldError name={name} error={form.errors[name]} />
              </div>
            ))}
          </div>
          <p id="times-hint" className="mt-2 text-xs text-graphite">
            All optional. Leave total empty to add up prep and cook.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label name="course" optional>
              Course
            </Label>
            <select {...field('course')}>
              <option value="">None</option>
              {recipe.courses.map((course) => (
                <option key={course} value={course}>
                  {course.charAt(0).toUpperCase() + course.slice(1)}
                </option>
              ))}
            </select>
            <FieldError name="course" error={form.errors.course} />
          </div>
          <div>
            <Label name="cuisine" optional>
              Cuisine
            </Label>
            <input maxLength={100} {...field('cuisine')} />
            <FieldError name="cuisine" error={form.errors.cuisine} />
          </div>
          <div>
            <Label name="main_ingredient" optional>
              Main ingredient
            </Label>
            <input maxLength={60} {...field('main_ingredient')} />
            <FieldError name="main_ingredient" error={form.errors.main_ingredient} />
          </div>
        </div>

        <div>
          <Label name="ingredients">Ingredients</Label>
          <p id="ingredients-hint" className="mt-1 text-sm text-graphite">
            One ingredient per line. Start a line with “# ” to add a heading, like “# For the sauce”.
          </p>
          <textarea rows={12} required maxLength={100000} {...field('ingredients', 'ingredients-hint')} />
          <FieldError name="ingredients" error={form.errors.ingredients} />
        </div>
        <div>
          <Label name="steps">Method</Label>
          <p id="steps-hint" className="mt-1 text-sm text-graphite">
            One step per line. Headings work here too.
          </p>
          <textarea rows={10} required maxLength={100000} {...field('steps', 'steps-hint')} />
          <FieldError name="steps" error={form.errors.steps} />
        </div>
        <div>
          <Label name="tips" optional>
            Good to know
          </Label>
          <p id="tips-hint" className="mt-1 text-sm text-graphite">
            One tip per line.
          </p>
          <textarea rows={3} maxLength={100000} {...field('tips', 'tips-hint')} />
          <FieldError name="tips" error={form.errors.tips} />
        </div>
        <div>
          <Label name="notes" optional>
            Your notes
          </Label>
          <p id="notes-hint" className="mt-1 text-sm text-graphite">
            What you changed, what to try next time.
          </p>
          <textarea rows={4} maxLength={10000} {...field('notes', 'notes-hint')} />
          <FieldError name="notes" error={form.errors.notes} />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={form.processing}
            className="rounded-full bg-yolk px-6 py-3 font-semibold text-[#18181b] hover:brightness-95 disabled:opacity-50"
          >
            {form.processing ? 'Saving…' : 'Save changes'}
          </button>
          <Link href={`/recipes/${recipe.id}`} className="px-3 py-3 text-graphite hover:text-ink">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}

function Label({ name, optional, children }: { name: FieldName; optional?: boolean; children: React.ReactNode }) {
  return (
    <label htmlFor={`recipe-${name}`} className="text-sm font-medium">
      {children}
      {optional && <span className="font-normal text-graphite"> (optional)</span>}
    </label>
  )
}

RecipeEdit.layout = AppLayout
