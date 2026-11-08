import { Link, useForm, usePage } from '@inertiajs/react'
import type { ReactNode } from 'react'
import CookbookImportForm from '@/components/CookbookImportForm'
import AppLayout from '@/layouts/AppLayout'
import FieldError, { inputClass } from '@/components/FieldError'
import { RECIPE_SORTS } from '@/lib/recipeSort'
import type { BrowserPreferences, CookbookImportSettings } from '@/types'

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
  cookbook_import: CookbookImportSettings
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
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">Settings</h1>
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
          <Section id="appearance" title="Appearance">
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
            <Section id="cooking" title="Cooking">
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
            <Section id="browsing" title="Browsing">
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
            </Section>
            <Section id="imports" title="Imports">
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
                <option value="ask">Use local recipe data only</option>
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

          <Section id="your-data" title="Your data">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-photo bg-paper p-5 ring-1 ring-hairline">
              <div>
                <p className="font-display text-xl font-semibold">
                  {count(instance.recipe_count, 'recipe')}, {count(instance.photo_count, 'photo')}
                </p>
                <p className="mt-1 text-sm text-graphite">Includes archived recipes, notes and cooking history</p>
              </div>
              <form
                action="/settings/export"
                method="post"
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
            </div>
            <details className="mt-3 text-sm text-graphite">
              <summary className="cursor-pointer py-2 text-ink">Export limits and backups</summary>
              <div className="mt-2 space-y-3">
                <p>A .tar.gz archive of readable JSON and original photos that another Sizzle server can import.</p>
                <p>
                  Up to {instance.export_limits.recipes.toLocaleString()} recipes,{' '}
                  {instance.export_limits.photos.toLocaleString()} photos,{' '}
                  {instance.export_limits.cooks.toLocaleString()} cooking entries and {instance.export_limits.mib} MiB.
                  Photos must be local and no larger than {instance.export_limits.image_mib} MiB each. Recipe data is
                  limited to {instance.export_limits.metadata_mib} MiB in total and {instance.export_limits.record_mib}{' '}
                  MiB per recipe. Preparation stops after {instance.export_limits.build_seconds} seconds and downloads
                  after {instance.export_limits.download_seconds} seconds. One export runs at a time, and an export that
                  hits a limit stops in full rather than leaving recipes out.
                </p>
                <p>
                  For larger collections or a full restore, follow the{' '}
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
              </div>
            </details>
            <h3 className="mt-8 mb-3 font-display text-xl font-semibold">Import a cookbook</h3>
            <CookbookImportForm settings={instance.cookbook_import} buttonClass={linkClass} />
          </Section>
          <Section id="about" title="About this instance">
            <Link href="/releases" className={`${linkClass} mb-4`}>
              What’s new in Sizzle
            </Link>
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

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="mb-10 scroll-mt-24 border-t border-hairline pt-6">
      <h2 id={`${id}-heading`} className="mb-5 font-display text-2xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  )
}

const count = (n: number, noun: string) => `${n.toLocaleString()} ${n === 1 ? noun : `${noun}s`}`

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 py-3">
      <dt className="text-graphite">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}

SettingsShow.layout = AppLayout
