import { Link } from '@inertiajs/react'
import type { ReactNode } from 'react'
import Icon from '@/components/Icon'
import ThemePicker from '@/components/ThemePicker'
import AppLayout from '@/layouts/AppLayout'
import type { SetupStatus, ThemeOption } from '@/types'

const steps = [
  { id: 'welcome', label: 'Your cookbook' },
  { id: 'look', label: 'Pick a look' },
  { id: 'ready', label: 'Add a recipe' },
] as const

type Props = { setup: SetupStatus; step: (typeof steps)[number]['id'] | 'claude'; themes?: ThemeOption[] }

const primary =
  'inline-flex items-center justify-center gap-2 rounded-full bg-action px-5 py-3 text-sm font-semibold text-on-action hover:brightness-95'
const secondary =
  'inline-flex items-center justify-center rounded-full px-5 py-3 text-sm ring-1 ring-hairline hover:ring-ink/30'

export default function SetupShow({ setup, step, themes }: Props) {
  const index = steps.findIndex((item) => item.id === step)

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm text-graphite">Your server. Your recipes.</p>
      <h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">Set up Sizzle</h1>
      <p className="mt-4 max-w-xl text-graphite">Your cookbook is ready to use. No AI account or API key required.</p>

      <nav aria-label="Setup steps" className="mt-8">
        <ol className="grid grid-cols-3 gap-2 sm:gap-4">
          {steps.map((item, position) => (
            <li key={item.id}>
              <Link
                href={`/setup?step=${item.id}`}
                aria-current={item.id === step ? 'step' : undefined}
                className={`flex h-full flex-col gap-3 rounded-2xl p-3 text-sm sm:p-4 ${item.id === step ? 'bg-mark ring-1 ring-active' : 'bg-paper ring-1 ring-hairline hover:ring-ink/30'}`}
              >
                <span
                  className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold ${item.id === step ? 'bg-active text-on-active' : 'bg-porcelain text-graphite'}`}
                >
                  {position + 1}
                </span>
                {item.label}
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      <section aria-labelledby="setup-heading" className="mt-6 rounded-photo bg-paper p-5 ring-1 ring-hairline sm:p-8">
        <p className="text-sm text-graphite">
          {step === 'claude' ? 'Optional' : `Step ${index + 1} of ${steps.length}`}
        </p>
        {step === 'welcome' && (
          <>
            <h2 id="setup-heading" className="mt-3 font-display text-3xl font-semibold">
              A home for your recipes
            </h2>
            <p className="mt-4 text-graphite">
              Keep the recipes you cook in one place, on your own server. Start with a family recipe or a link to a
              recipe you want to try.
            </p>
            <ul className="mt-6 space-y-4 text-sm">
              <li>
                <strong>Write a recipe.</strong> Add a title, ingredients and method yourself.
              </li>
              <li>
                <strong>Import a link.</strong> Sizzle reads recipe data provided by the website and saves it with a
                photo.
              </li>
              <li>
                <strong>Add AI later.</strong> Optional Claude extraction helps with other pages and unstructured pasted
                text.
              </li>
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/setup?step=look" className={primary}>
                Continue
              </Link>
              <Link href="/imports?mode=manual" className={secondary}>
                Write a recipe
              </Link>
            </div>
          </>
        )}
        {step === 'look' && themes && (
          <>
            <h2 id="setup-heading" className="mt-3 font-display text-3xl font-semibold">
              Pick a look
            </h2>
            <p className="mt-4 mb-8 text-graphite">
              Choose a theme and whether Sizzle is light, dark or follows this device. It’s saved in this browser, and
              you can change it any time from Appearance at the top of the page.
            </p>
            <ThemePicker themes={themes} submitLabel="Continue" next="setup" />
            <div className="mt-6">
              <Link href="/setup?step=welcome" className={secondary}>
                Back
              </Link>
            </div>
          </>
        )}
        {step === 'claude' && (
          <>
            <h2 id="setup-heading" className="mt-3 font-display text-3xl font-semibold">
              Optional AI extraction
            </h2>
            <p className="mt-4 text-graphite">
              Manual entry and links with recipe data work without AI. Add Claude to extract other pages and turn
              unstructured pasted text into ingredients and steps. Each AI extraction uses a paid Claude request.
            </p>
            <Status done={setup.claude_configured}>
              {setup.claude_configured ? 'Claude API key is configured' : 'AI is off — your cookbook still works'}
            </Status>
            <p className="mt-4 text-sm text-graphite">
              This checks for a configured key. An import that needs AI will confirm it works.
            </p>
            {!setup.claude_configured && (
              <ol className="mt-6 list-decimal space-y-4 pl-5 text-sm">
                <li>
                  Create a key in your{' '}
                  <a
                    href="https://console.anthropic.com/settings/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-4"
                  >
                    Anthropic account
                  </a>
                  .
                </li>
                <li>
                  Set <code className="break-all">ANTHROPIC_API_KEY</code> in your server’s <code>.env</code> file or
                  container environment. Keep the key on your server.
                </li>
                <li>
                  Apply the change. For Docker Compose, run <Command>docker compose up -d --force-recreate</Command>
                  For other installs, restart Sizzle with the updated environment.
                </li>
              </ol>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/setup?step=ready" className={primary}>
                {setup.claude_configured ? 'Add a recipe' : 'Continue without AI'}
              </Link>
              <Link href="/setup?step=claude" preserveScroll className={secondary}>
                Check again
              </Link>
            </div>
          </>
        )}

        {step === 'ready' && (
          <>
            <h2 id="setup-heading" className="mt-3 font-display text-3xl font-semibold">
              Your first recipe
            </h2>
            <p className="mt-4 text-graphite">
              Import a link with recipe data, or write a recipe yourself. Both work without an API key.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/imports" className={primary}>
                <Icon name="plus" className="size-4" />
                Add your first recipe
              </Link>
              <Link href="/imports?mode=manual" className={secondary}>
                Write a recipe
              </Link>
            </div>
            <div className="mt-8 border-t border-hairline pt-6">
              <h3 className="font-display text-xl font-semibold">Save recipes from your phone</h3>
              <p className="mt-2 text-sm text-graphite">
                Add a Shortcut to your iPhone’s share sheet. You can set this up now or come back to it later.
              </p>
              <Link href="/share" className={`mt-4 ${secondary}`}>
                Set up phone sharing
              </Link>
            </div>
            <div className="mt-8 border-t border-hairline pt-6">
              <h3 className="font-display text-xl font-semibold">Optional AI extraction</h3>
              <p className="mt-2 text-sm text-graphite">
                {setup.claude_configured
                  ? 'Claude is configured for pages without usable recipe data and unstructured pasted text.'
                  : 'Add Claude later to extract pages without recipe data and clean up unstructured pasted text.'}
              </p>
              <Link href="/setup?step=claude" className={`mt-4 ${secondary}`}>
                {setup.claude_configured ? 'Review AI setup' : 'Set up optional AI'}
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/" className={secondary}>
                Go to my cookbook
              </Link>
              <Link href="/setup?step=look" className={secondary}>
                Back
              </Link>
            </div>
          </>
        )}
      </section>
      <p className="mt-5 text-center text-xs text-graphite">
        Sizzle has no login. Keep it on a private network unless you’ve added access protection.
      </p>
      <p className="mt-2 text-center text-xs text-graphite">Sizzle {setup.version}</p>
    </div>
  )
}

SetupShow.layout = AppLayout

function Status({ done, children }: { done: boolean; children: ReactNode }) {
  return (
    <p role="status" className="mt-6 flex items-center gap-3 rounded-2xl bg-porcelain p-4 text-sm font-medium">
      <span
        className={`flex size-7 shrink-0 items-center justify-center rounded-full ${done ? 'bg-active text-on-active' : 'ring-1 ring-hairline'}`}
      >
        {done ? <Icon name="check" className="size-4" /> : '—'}
      </span>
      {children}
    </p>
  )
}

function Command({ children }: { children: string }) {
  return (
    <pre className="my-3 overflow-x-auto rounded-xl bg-porcelain p-4 text-xs">
      <code>{children}</code>
    </pre>
  )
}
