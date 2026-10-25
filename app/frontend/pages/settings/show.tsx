import { Link, useForm, usePage } from '@inertiajs/react'
import type { ReactNode } from 'react'
import AppLayout from '@/layouts/AppLayout'
import FieldError, { inputClass } from '@/components/FieldError'
import { RECIPE_SORTS } from '@/lib/recipeSort'
import type { BrowserPreferences } from '@/types'

type Instance = {
  api_protected: boolean
  recipe_count: number
  photo_count: number
  theme_name: string
  export_limits: {
    recipes: number
    mib: number
    photos: number
    cooks: number
    image_mib: number
    metadata_mib: number
    record_mib: number
    build_seconds: number
    download_seconds: number
  }
}
const sections = [
  ['appearance', 'Appearance'],
  ['cooking', 'Cooking'],
  ['browsing', 'Browsing'],
  ['imports', 'Imports'],
  ['your-data', 'Your data'],
  ['about', 'About this instance'],
]
const linkClass =
  'inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-medium ring-1 ring-hairline hover:bg-paper'

export default function SettingsShow({ instance }: { instance: Instance }) {
  const { preferences, appearance, app } = usePage().props
  const form = useForm<BrowserPreferences>({ ...preferences })

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8 sm:mb-12">
        <p className="mb-3 text-sm text-graphite">Make yourself at home</p>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">Settings</h1>
        <p className="mt-4 max-w-xl text-graphite">
          A few choices for how you browse and cook. Preferences are saved in this browser, so everyone can have their
          own.
        </p>
      </header>
      <div className="grid gap-8 md:grid-cols-[11rem_minmax(0,1fr)] md:gap-12">
        <nav aria-label="Settings sections" className="md:sticky md:top-24 md:self-start">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 md:flex-col md:gap-1">
            {sections.map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="inline-block py-2 text-sm text-graphite underline-offset-4 hover:text-ink hover:underline"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0">
          <Section id="appearance" title="Appearance" hint="A look that feels right, day or night.">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-photo bg-paper p-5 ring-1 ring-hairline">
              <div>
                <p className="font-display text-xl font-semibold">{instance.theme_name}</p>
                <p className="mt-1 text-sm text-graphite">
                  {appearance.mode === 'auto'
                    ? 'Follows this device'
                    : `${appearance.mode === 'light' ? 'Light' : 'Dark'} mode`}
                </p>
              </div>
              <Link href="/appearance" className={linkClass}>
                Change appearance
              </Link>
            </div>
          </Section>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              form.transform((data) => ({ preferences: data }))
              form.patch('/settings', { preserveScroll: true, onSuccess: () => form.setDefaults({ ...form.data }) })
            }}
          >
            <Section id="cooking" title="Cooking" hint="Make the recipe easier to follow at the counter.">
              <label htmlFor="text-size" className="block text-sm font-medium">
                Recipe text in cooking mode
              </label>
              <select
                id="text-size"
                className={`${inputClass} mt-2 w-full sm:max-w-xs`}
                value={form.data.text_size}
                onChange={(event) => form.setData('text_size', event.target.value as BrowserPreferences['text_size'])}
              >
                <option value="standard">Standard</option>
                <option value="large">Large</option>
              </select>
              <FieldError name="text_size" error={form.errors.text_size} />
              <div
                aria-label="Cooking text preview"
                className={`mt-4 rounded-photo border border-hairline p-5 ${form.data.text_size === 'large' ? 'text-2xl' : 'text-base'}`}
              >
                <p>
                  <span className="font-medium">2 tbsp</span> olive oil
                </p>
                <p className="mt-3 text-graphite">Warm the oil in a large pan over medium heat.</p>
              </div>
              <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  aria-describedby="awake-help"
                  checked={form.data.keep_awake === 'on'}
                  onChange={(event) => form.setData('keep_awake', event.target.checked ? 'on' : 'off')}
                  className="mt-1 rounded border-hairline bg-paper text-ink focus:ring-ink"
                />
                Keep the screen awake while cooking
              </label>
              <p id="awake-help" className="mt-1 ml-7 text-sm text-graphite">
                Applies after you start cooking on a recipe. Available in supported browsers on HTTPS or localhost.
              </p>
              <FieldError name="keep_awake" error={form.errors.keep_awake} />
            </Section>
            <Section id="browsing" title="Browsing" hint="Open your cookbook the way you like it.">
              <label htmlFor="recipe-sort" className="block text-sm font-medium">
                Recipe order
              </label>
              <select
                id="recipe-sort"
                className={`${inputClass} mt-2 w-full sm:max-w-xs`}
                value={form.data.sort}
                onChange={(event) => form.setData('sort', event.target.value as BrowserPreferences['sort'])}
              >
                {RECIPE_SORTS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <FieldError name="sort" error={form.errors.sort} />
              <p className="mt-3 text-sm text-graphite">
                You can also change the order in your cookbook. Grid or list view is remembered there too.
              </p>
            </Section>
            <Section id="imports" title="Imports" hint="Recipe data is always read locally first.">
              <p className="mb-4 text-sm text-graphite">
                {app.claude_configured
                  ? 'Optional Claude extraction is configured on this server.'
                  : 'Claude is not configured. Links with recipe data and manual recipes work without it.'}
              </p>
              <label htmlFor="ai-mode" className="block text-sm font-medium">
                When a web import needs Claude
              </label>
              <select
                id="ai-mode"
                className={`${inputClass} mt-2 w-full`}
                value={form.data.ai_mode}
                onChange={(event) => form.setData('ai_mode', event.target.value as BrowserPreferences['ai_mode'])}
              >
                <option value="ask">Ask for permission on each import</option>
                <option value="automatic">Use Claude automatically when needed</option>
              </select>
              <FieldError name="ai_mode" error={form.errors.ai_mode} />
              <p className="mt-3 text-sm text-graphite">
                When allowed, page text, recipe data and image links, or your pasted recipe text, are sent to Anthropic
                for extraction. This may incur API charges.
              </p>
              <p className="mt-3 text-sm text-graphite">
                This choice applies to imports from this browser. Phone shortcuts and scripts use the server’s AI
                configuration.
              </p>
            </Section>
            <div className="mb-10 flex flex-wrap items-center gap-4">
              <button
                type="submit"
                disabled={form.processing || !form.isDirty}
                className="min-h-11 rounded-full bg-action px-6 py-3 font-semibold text-on-action hover:brightness-95 disabled:opacity-50"
              >
                {form.processing ? 'Saving…' : 'Save preferences'}
              </button>
              <p role="status" className="text-sm text-graphite">
                {form.isDirty
                  ? 'You have unsaved changes.'
                  : form.recentlySuccessful
                    ? 'Preferences saved.'
                    : 'Saved in this browser.'}
              </p>
            </div>
          </form>

          <Section id="your-data" title="Your data" hint="Your cookbook belongs to you.">
            <p className="text-sm text-graphite">
              Download all {instance.recipe_count} recipes and {instance.photo_count} photos, including archived
              recipes, notes, favorites, ratings and cooking history.
            </p>
            <form
              action="/settings/export"
              method="post"
              className="mt-4"
              onSubmit={(event) => {
                const token = event.currentTarget.elements.namedItem('authenticity_token') as HTMLInputElement
                token.value = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? ''
              }}
            >
              <input type="hidden" name="authenticity_token" defaultValue="" />
              <button type="submit" className={linkClass}>
                Download cookbook
              </button>
            </form>
            <p className="mt-3 text-sm text-graphite">
              Downloads a .tar.gz archive with readable JSON and original images. Export is portable; restoring an
              export into Sizzle is not yet supported.
            </p>
            <p className="mt-3 text-sm text-graphite">
              Up to {instance.export_limits.recipes.toLocaleString()} recipes and {instance.export_limits.mib} MiB. Only
              one export can run at a time. Preparation stops after {instance.export_limits.build_seconds} seconds;
              downloads stop after {instance.export_limits.download_seconds} seconds. For larger collections or slow
              connections, use a server backup.
            </p>
            <details className="mt-3 text-sm text-graphite">
              <summary className="cursor-pointer py-2 text-ink">Additional export limits</summary>
              <p className="mt-2">
                Up to {instance.export_limits.photos.toLocaleString()} photos and{' '}
                {instance.export_limits.cooks.toLocaleString()} cooking entries. Photos must be local and no larger than{' '}
                {instance.export_limits.image_mib} MiB each. Recipe data is limited to{' '}
                {instance.export_limits.metadata_mib} MiB in total and {instance.export_limits.record_mib} MiB per
                recipe. An export is stopped in full if a limit is exceeded; recipes are never silently left out.
              </p>
            </details>
            <p className="mt-3 text-sm text-graphite">
              For a full server backup and restore, follow the{' '}
              <a
                href="https://github.com/leemac/sizzle/blob/main/docs/self-hosting.md#back-up"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4"
              >
                backup instructions
              </a>
              .
            </p>
          </Section>
          <Section id="about" title="About this instance" hint="Server configuration is managed by your host.">
            <dl className="divide-y divide-hairline text-sm">
              <Info label="Version" value={app.version === 'dev' ? 'Development' : app.version} />
              <Info label="Claude extraction" value={app.claude_configured ? 'Configured' : 'Not configured'} />
              <Info label="Share API token" value={instance.api_protected ? 'Required' : 'Not configured'} />
            </dl>
            <Link href="/share" className={`${linkClass} mt-5`}>
              Set up sharing from your phone
            </Link>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ id, title, hint, children }: { id: string; title: string; hint: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="mb-10 scroll-mt-24 border-t border-hairline pt-6">
      <h2 id={`${id}-heading`} className="font-display text-2xl font-semibold">
        {title}
      </h2>
      <p className="mt-2 mb-5 text-sm text-graphite">{hint}</p>
      {children}
    </section>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 py-3">
      <dt className="text-graphite">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}

SettingsShow.layout = AppLayout
