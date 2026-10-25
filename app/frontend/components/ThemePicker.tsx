import { useForm, usePage } from '@inertiajs/react'
import { useEffect } from 'react'
import FieldError from '@/components/FieldError'
import Icon from '@/components/Icon'
import { applyAppearance, MODES, savedLook, schemeFor, themeStyle, usePrefersDark } from '@/lib/theme'
import type { ThemeMode, ThemeOption, ThemeToken } from '@/types'

type Props = {
  themes: ThemeOption[]
  submitLabel: string
  /** Set during setup so saving moves on to the next step. */
  next?: 'setup'
}

/**
 * Pick a theme and light, dark or auto. Nothing is preselected until this browser
 * has chosen once, so setup can't be skipped. The page previews the choice live
 * and goes back to the saved look if you leave without saving.
 */
export default function ThemePicker({ themes, submitLabel, next }: Props) {
  const { appearance } = usePage().props
  const form = useForm<{ theme: string; mode: ThemeMode | ''; next: string }>({
    theme: appearance.chosen ? appearance.theme : '',
    mode: appearance.chosen ? appearance.mode : '',
    next: next ?? '',
  })
  const prefersDark = usePrefersDark()
  const scheme = schemeFor(form.data.mode || 'auto', prefersDark)
  const ready = form.data.theme !== '' && form.data.mode !== ''

  useEffect(() => {
    const look = savedLook()
    applyAppearance(document.documentElement, form.data.theme || look.theme, form.data.mode || look.mode)
  }, [form.data.theme, form.data.mode])
  useEffect(
    () => () => {
      const look = savedLook()
      applyAppearance(document.documentElement, look.theme, look.mode)
    },
    [],
  )

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        form.patch('/appearance', { preserveScroll: true })
      }}
      className="space-y-8"
    >
      <fieldset aria-describedby={form.errors.mode ? 'mode-error' : undefined}>
        <legend className="font-display text-xl font-semibold">Light or dark</legend>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:max-w-md">
          {MODES.map((mode) => (
            <label
              key={mode.value}
              className="flex cursor-pointer flex-col items-center rounded-2xl bg-paper px-2 py-3 text-center ring-1 ring-hairline has-checked:bg-active has-checked:text-on-active has-checked:ring-active has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink hover:ring-ink/30"
            >
              <input
                type="radio"
                name="mode"
                value={mode.value}
                checked={form.data.mode === mode.value}
                onChange={() => form.setData('mode', mode.value)}
                className="sr-only"
              />
              <span className="text-sm font-semibold">{mode.label}</span>
              <span className="text-xs opacity-75">{mode.hint}</span>
            </label>
          ))}
        </div>
        <FieldError name="mode" error={form.errors.mode} />
      </fieldset>

      <fieldset aria-describedby={form.errors.theme ? 'theme-error' : undefined}>
        <legend className="font-display text-xl font-semibold">Theme</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {themes.map((theme) => {
            const selected = form.data.theme === theme.id
            return (
              <label
                key={theme.id}
                className="flex cursor-pointer flex-col gap-3 rounded-photo bg-paper p-3 ring-1 ring-hairline has-checked:ring-2 has-checked:ring-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink hover:ring-ink/30"
              >
                <input
                  type="radio"
                  name="theme"
                  value={theme.id}
                  checked={selected}
                  onChange={() => form.setData('theme', theme.id)}
                  className="sr-only"
                />
                <ThemePreview tokens={theme[scheme]} />
                <span className="flex items-start justify-between gap-3 px-1 pb-1">
                  <span>
                    <span className="block font-display text-lg font-semibold">{theme.name}</span>
                    <span className="block text-sm text-graphite">{theme.description}</span>
                  </span>
                  <span
                    className={`mt-1 flex size-6 shrink-0 items-center justify-center rounded-full ${selected ? 'bg-ink text-paper' : 'ring-1 ring-hairline'}`}
                  >
                    {selected && <Icon name="check" className="size-4" />}
                  </span>
                </span>
              </label>
            )
          })}
        </div>
        <FieldError name="theme" error={form.errors.theme} />
      </fieldset>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={!ready || form.processing}
          className="rounded-full bg-action px-6 py-3 font-semibold text-on-action hover:brightness-95 disabled:opacity-50"
        >
          {submitLabel}
        </button>
        {!ready && <p className="text-sm text-graphite">Pick a theme and light, dark or auto to continue.</p>}
      </div>
    </form>
  )
}

/** A small recipe card drawn in one theme, using the same classes as the real pages. */
function ThemePreview({ tokens }: { tokens: Record<ThemeToken, string> }) {
  return (
    <span
      aria-hidden="true"
      style={themeStyle(tokens)}
      className="block rounded-xl bg-porcelain p-3 text-ink ring-1 ring-hairline"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="font-display text-sm font-bold tracking-tight">Sizzle</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-action px-2 py-0.5 text-[11px] font-semibold text-on-action">
          <Icon name="plus" className="size-3" />
          Add recipe
        </span>
      </span>
      <span className="mt-3 block font-display text-lg leading-tight font-semibold">Ginger lime spritz</span>
      <span className="mt-2 flex flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-active px-2 py-0.5 text-[11px] font-medium text-on-active">
          <Icon name="heart" filled className="size-3" />
          Favorited
        </span>
        <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] ring-1 ring-hairline">vegan</span>
        <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] text-accent ring-1 ring-hairline">
          <Icon name="heart" filled className="inline size-3" />
        </span>
      </span>
      <span className="mt-2 block rounded-lg bg-paper p-2 text-xs ring-1 ring-hairline">
        <span className="highlight">40 g fresh ginger</span>
        <span className="block text-graphite">60 g caster sugar</span>
      </span>
    </span>
  )
}
