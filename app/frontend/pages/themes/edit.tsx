import { Link, router, useForm, usePage } from '@inertiajs/react'
import { useState } from 'react'
import FieldError, { inputClass } from '@/components/FieldError'
import Icon from '@/components/Icon'
import Tabs from '@/components/Tabs'
import AppLayout from '@/layouts/AppLayout'
import { contrastProblems } from '@/lib/contrast'
import { themeStyle } from '@/lib/theme'
import type { ThemeColors, ThemeDraft, ThemeToken } from '@/types'

type Props = { theme: ThemeDraft; based_on: string | null }
type Mode = 'light' | 'dark'

// Every colour role, grouped the way it shows up on a page.
const GROUPS: { title: string; fields: { token: ThemeToken; label: string }[] }[] = [
  {
    title: 'Page',
    fields: [
      { token: 'porcelain', label: 'Background' },
      { token: 'paper', label: 'Cards and inputs' },
      { token: 'hairline', label: 'Borders' },
    ],
  },
  {
    title: 'Text',
    fields: [
      { token: 'ink', label: 'Text' },
      { token: 'graphite', label: 'Secondary text' },
    ],
  },
  {
    title: 'Main button',
    fields: [
      { token: 'action', label: 'Button' },
      { token: 'on-action', label: 'Button label' },
    ],
  },
  {
    title: 'Selected and done',
    fields: [
      { token: 'active', label: 'Selected' },
      { token: 'on-active', label: 'Selected label' },
    ],
  },
  {
    title: 'Accents',
    fields: [
      { token: 'mark', label: 'Highlighter' },
      { token: 'accent', label: 'Heart and bullets' },
    ],
  },
  {
    title: 'Errors and deleting',
    fields: [
      { token: 'danger', label: 'Errors and delete' },
      { token: 'on-danger', label: 'Delete button label' },
    ],
  },
]

const secondary = 'inline-flex items-center rounded-full px-5 py-3 text-sm ring-1 ring-hairline hover:ring-ink/30'

export default function ThemeEdit({ theme, based_on }: Props) {
  const { errors } = usePage().props
  const form = useForm({ name: theme.name, description: theme.description, light: theme.light, dark: theme.dark })
  const saved = theme.id !== null

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    form.transform((data) => ({ theme: data }))
    const options = { preserveScroll: 'errors' as const }
    if (saved) form.patch(`/themes/${theme.id}`, options)
    else form.post('/themes', options)
  }

  const setColor = (mode: Mode, token: ThemeToken, value: string) =>
    form.setData(mode, { ...form.data[mode], [token]: value })

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/appearance" className="inline-flex items-center gap-1 text-sm text-graphite hover:text-ink">
        <Icon name="back" className="size-4" />
        Appearance
      </Link>
      <h1 className="mt-4 font-display text-4xl font-semibold sm:text-5xl">{saved ? 'Edit theme' : 'New theme'}</h1>
      <p className="mt-4 max-w-2xl text-graphite">
        {based_on && `Starting from ${based_on}. `}Choose colours for light and dark. Saving switches this browser to
        the theme, and everyone using this Sizzle can pick it too.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-8">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div>
            <label htmlFor="theme-name" className="text-sm font-medium">
              Name
            </label>
            <input
              id="theme-name"
              required
              maxLength={40}
              value={form.data.name}
              onChange={(event) => form.setData('name', event.target.value)}
              className={inputClass}
              aria-invalid={!!form.errors.name}
              aria-describedby={form.errors.name ? 'name-error' : undefined}
            />
            <FieldError name="name" error={form.errors.name} />
          </div>
          <div>
            <label htmlFor="theme-description" className="text-sm font-medium">
              Description (optional)
            </label>
            <input
              id="theme-description"
              maxLength={119}
              value={form.data.description}
              onChange={(event) => form.setData('description', event.target.value)}
              className={inputClass}
              aria-invalid={!!form.errors.description}
              aria-describedby={form.errors.description ? 'description-error' : undefined}
            />
            <FieldError name="description" error={form.errors.description} />
          </div>
        </div>

        <Tabs
          label="Colours for"
          tabs={(['light', 'dark'] as const).map((mode) => ({
            id: mode,
            label: mode === 'light' ? 'Light colours' : 'Dark colours',
            content: (
              <ModeEditor
                mode={mode}
                colors={form.data[mode]}
                error={form.errors[mode]}
                onChange={(token, value) => setColor(mode, token, value)}
              />
            ),
          }))}
        />

        <FieldError name="base" error={errors.base} />

        <div className="flex flex-wrap items-center gap-3 border-t border-hairline pt-6">
          <button
            type="submit"
            disabled={form.processing}
            className="rounded-full bg-action px-6 py-3 font-semibold text-on-action hover:brightness-95 disabled:opacity-50"
          >
            {saved ? 'Save theme' : 'Save and use theme'}
          </button>
          <Link href="/appearance" className={secondary}>
            Cancel
          </Link>
          {saved && <DeleteTheme id={theme.id!} name={theme.name} />}
        </div>
      </form>
    </div>
  )
}

ThemeEdit.layout = AppLayout

function ModeEditor({
  mode,
  colors,
  error,
  onChange,
}: {
  mode: Mode
  colors: ThemeColors
  error?: string
  onChange: (token: ThemeToken, value: string) => void
}) {
  const problems = contrastProblems(colors)

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <div className="grid gap-6 sm:grid-cols-2">
        {GROUPS.map((group) => (
          <fieldset key={group.title}>
            <legend className="font-display text-lg font-semibold">{group.title}</legend>
            <div className="mt-2 space-y-2">
              {group.fields.map((field) => (
                <ColorField
                  key={field.token}
                  id={`${mode}-${field.token}`}
                  label={field.label}
                  value={colors[field.token]}
                  onChange={(value) => onChange(field.token, value)}
                />
              ))}
            </div>
          </fieldset>
        ))}
        <FieldError name={mode} error={error} />
      </div>

      {/* On phones the preview comes first, so changes are visible without scrolling past every field. */}
      <div className="order-first space-y-4 lg:sticky lg:top-24 lg:order-none lg:self-start">
        <EditorPreview colors={colors} />
        <section aria-live="polite" className="rounded-2xl bg-paper p-4 text-sm ring-1 ring-hairline">
          <h3 className="font-semibold">Readability</h3>
          {problems.length === 0 ? (
            <p className="mt-1 flex items-center gap-2 text-graphite">
              <Icon name="check" className="size-4" />
              Everything is easy to read in {mode}.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {problems.map((problem) => (
                <li key={problem.label}>
                  <span className="font-medium">{problem.label}</span> is hard to read:{' '}
                  <span className="tabular-nums">{problem.ratio.toFixed(1)}:1</span>, aim for {problem.minimum}:1.
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

/** A colour picker with a hex box beside it, for pasting a colour from elsewhere. */
function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
  // What's typed in the hex box while it's being edited; otherwise it shows the colour.
  const [draft, setDraft] = useState<string | null>(null)

  return (
    <div className="flex items-center gap-3">
      <input
        id={id}
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value.toLowerCase())}
        className="size-10 shrink-0 cursor-pointer rounded-xl border-0 bg-transparent p-0 ring-1 ring-hairline"
      />
      <label htmlFor={id} className="min-w-0 flex-1 text-sm">
        {label}
      </label>
      <input
        aria-label={`${label} hex`}
        value={draft ?? value}
        maxLength={7}
        spellCheck={false}
        onChange={(event) => {
          const next = event.target.value.trim().toLowerCase()
          setDraft(next)
          if (/^#[0-9a-f]{6}$/.test(next)) onChange(next)
        }}
        onBlur={() => setDraft(null)}
        className="w-24 rounded-lg border-hairline bg-paper px-2 py-1.5 font-mono text-sm focus:border-ink focus:ring-0"
      />
    </div>
  )
}

/** A recipe page in miniature that uses every colour role. */
function EditorPreview({ colors }: { colors: ThemeColors }) {
  return (
    <div
      aria-hidden="true"
      style={themeStyle(colors)}
      className="overflow-hidden rounded-photo bg-porcelain text-ink ring-1 ring-hairline"
    >
      <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
        <span className="font-display text-lg font-bold tracking-tight">Sizzle</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-action px-3 py-1 text-xs font-semibold text-on-action">
          <Icon name="plus" className="size-3.5" />
          Add recipe
        </span>
      </div>
      <div className="space-y-4 p-4">
        <div>
          <p className="font-display text-2xl leading-tight font-semibold">Ginger lime spritz</p>
          <p className="mt-1 text-sm text-graphite">Fresh ginger syrup, lime and sparkling water.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-active px-3 py-1 font-medium text-on-active">
            <Icon name="heart" filled className="size-3.5" />
            Favorited
          </span>
          <span className="rounded-full bg-paper px-3 py-1 ring-1 ring-hairline">vegan</span>
        </div>
        <div className="relative space-y-2 rounded-xl bg-paper p-3 text-sm ring-1 ring-hairline">
          <span className="absolute top-3 right-3 text-accent">
            <Icon name="heart" filled className="size-4" />
          </span>
          <p className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded-full bg-active text-on-active">
              <Icon name="check" className="size-3.5" />
            </span>
            <span className="highlight">40 g fresh ginger</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="size-5 rounded-full ring-1 ring-hairline" />
            <span>
              3 limes, <span className="text-graphite">juiced</span>
            </span>
          </p>
        </div>
        <p className="flex gap-3 rounded-xl bg-mark p-3 text-sm">
          <span className="font-display font-bold">2</span>
          Let the syrup steep and cool for 20 minutes.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-danger">Couldn’t read that page.</span>
          <span className="rounded-full bg-danger px-3 py-1 font-medium text-on-danger">Delete recipe</span>
        </div>
      </div>
    </div>
  )
}

function DeleteTheme({ id, name }: { id: number; name: string }) {
  const [confirming, setConfirming] = useState(false)

  if (!confirming)
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="ml-auto px-3 py-2 text-sm text-danger hover:underline"
      >
        Delete theme
      </button>
    )

  return (
    <span className="ml-auto flex flex-wrap items-center gap-3 text-sm">
      <span>Delete “{name}”? Anyone using it goes back to the default.</span>
      <button
        type="button"
        onClick={() => router.delete(`/themes/${id}`)}
        className="rounded-full bg-danger px-4 py-1.5 font-medium text-on-danger"
      >
        Delete theme
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="text-graphite hover:text-ink">
        Keep it
      </button>
    </span>
  )
}
