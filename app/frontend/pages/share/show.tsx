import { Head, Link } from '@inertiajs/react'
import { useState, type ReactNode } from 'react'
import Icon from '@/components/Icon'
import AppLayout from '@/layouts/AppLayout'
import { copyText } from '@/lib/clipboard'
import { isTailscaleHost } from '@/lib/network'

type ShortcutEndpoint = { url: string; network: 'home' | 'tailscale' | null }

type Props = { endpoint: string; shortcut_endpoints: ShortcutEndpoint[]; token_required: boolean }

const NETWORK_LABELS = { home: 'On your home Wi-Fi', tailscale: 'Through Tailscale, at home or away' }

const card = 'mt-6 rounded-photo bg-paper p-5 ring-1 ring-hairline sm:p-8'
const minorCard = 'rounded-photo bg-paper p-5 ring-1 ring-hairline sm:p-6'
const code = 'rounded-md bg-porcelain px-1.5 py-0.5 text-[0.9em] ring-1 ring-hairline'
const external =
  'inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm ring-1 ring-hairline hover:ring-ink/30'

export default function ShareShow({ endpoint, shortcut_endpoints, token_required }: Props) {
  const host = new URL(endpoint).hostname
  const tailscaleOnServer = shortcut_endpoints.some(({ network }) => network === 'tailscale')
  const viaTailscale = isTailscaleHost(host)

  return (
    <div className="mx-auto max-w-3xl">
      <Head title="Share from your phone" />
      <p className="text-sm text-graphite">iPhone and iPad</p>
      <h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">Share from your phone</h1>
      <p className="mt-4 max-w-xl text-graphite">
        Build a Shortcut once, in about two minutes. Then tap Share on any recipe page or recipe text and choose Save to
        Sizzle.
      </p>

      <section aria-labelledby="build-heading" className={card}>
        <h2 id="build-heading" className="font-display text-3xl font-semibold">
          Build the Shortcut
        </h2>
        <ol className="mt-6 space-y-7">
          <Step number={1} title="Create it">
            Open the Shortcuts app, tap <strong>+</strong> and name the shortcut “Save to Sizzle”.
          </Step>
          <Step number={2} title="Put it in the share sheet">
            Tap the info button, turn on <strong>Show in Share Sheet</strong>, and set it to receive{' '}
            <strong>URLs</strong> and <strong>Text</strong>.
          </Step>
          <Step number={3} title="Send what you share to Sizzle">
            <ShortcutUrl endpoint={endpoint} endpoints={shortcut_endpoints} />
            <p className="mt-4">
              Tap <strong>Show More</strong> on that action and set:
            </p>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-2xl bg-porcelain p-4 text-sm">
              <dt className="text-graphite">Method</dt>
              <dd className="font-medium">POST</dd>
              <dt className="text-graphite">Request Body</dt>
              <dd className="font-medium">JSON</dd>
              <dt className="text-graphite">Field</dt>
              <dd>
                A Text field named <code className={code}>text</code>, set to <strong>Shortcut Input</strong>
              </dd>
              {token_required && (
                <>
                  <dt className="text-graphite">Header</dt>
                  <dd>
                    <code className={code}>Authorization</code>, set to <code className={code}>Bearer</code>, a space,
                    then your SIZZLE_API_TOKEN
                  </dd>
                </>
              )}
            </dl>
            <p className="mt-3 text-sm text-graphite">
              Sizzle works out whether you shared a link or the recipe itself.
            </p>
          </Step>
          <Step number={4} title="Know it worked">
            Add a <strong>Show Notification</strong> action saying “Saved to Sizzle”.
          </Step>
        </ol>

        <div className="mt-8 border-t border-hairline pt-6">
          <h3 className="font-display text-xl font-semibold">Try it</h3>
          <p className="mt-2 text-sm text-graphite">
            Open a recipe in Safari, tap Share and choose Save to Sizzle. It shows up in Imports within a few seconds,
            then in your cookbook.
          </p>
          <Link href="/imports" className={`mt-4 ${external}`}>
            Open imports
          </Link>
        </div>
      </section>

      <section aria-labelledby="away-heading" className={card}>
        <h2 id="away-heading" className="font-display text-3xl font-semibold">
          Save recipes away from home
        </h2>
        <p className="mt-4 text-graphite">
          Your phone has to reach this server to send it a recipe. On your home Wi-Fi it can. Everywhere else, use{' '}
          <a href="https://tailscale.com" target="_blank" rel="noreferrer" className="underline underline-offset-4">
            Tailscale
          </a>
          , a free private network that connects your phone to your server without opening it to the internet.
        </p>
        {(tailscaleOnServer || viaTailscale) && (
          <Status done>
            {viaTailscale ? 'You’re using Sizzle through Tailscale' : 'Tailscale is running on this server'}
          </Status>
        )}
        <ol className="mt-6 space-y-7">
          <Step number={1} title="Install Tailscale on both">
            Install it on this server and on your phone, and sign in to the same account on each.
          </Step>
          <Step number={2} title="Use the Tailscale address in your Shortcut">
            Open Sizzle on your phone using the server’s Tailscale name or 100.x address and come back to this page: the
            Shortcut URL above will use it. It works at home and away, as long as Tailscale is on.
          </Step>
          <Step number={3} title="Keep it private">
            Leave Tailscale Funnel off for Sizzle. Funnel publishes a server to the whole internet, and Sizzle has no
            login yet.
          </Step>
        </ol>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="https://tailscale.com/download" target="_blank" rel="noreferrer" className={external}>
            Get Tailscale
            <Icon name="external" className="size-4" />
          </a>
          <a href="https://tailscale.com/kb/1081/magicdns" target="_blank" rel="noreferrer" className={external}>
            How server names work
            <Icon name="external" className="size-4" />
          </a>
        </div>
      </section>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <section aria-labelledby="private-heading" className={minorCard}>
          <h2 id="private-heading" className="font-display text-xl font-semibold">
            Who can add recipes
          </h2>
          <Status done={token_required}>
            {token_required ? 'Shares need your API token' : 'Anyone who can reach this server can add recipes'}
          </Status>
          <p className="mt-4 text-sm text-graphite">
            {token_required
              ? 'The Shortcut sends the token with each share. Requests without it are refused.'
              : 'That’s fine on a home network you trust. To require a token, set SIZZLE_API_TOKEN in your server’s .env file and restart Sizzle, then add the header in step 3.'}{' '}
            Don’t put Sizzle on the open internet: it has no login yet.
          </p>
        </section>

        <section aria-labelledby="trouble-heading" className={minorCard}>
          <h2 id="trouble-heading" className="font-display text-xl font-semibold">
            If it doesn’t work
          </h2>
          <dl className="mt-4 space-y-4 text-sm">
            <Trouble problem="“Could not connect to the server”">
              Your phone can’t reach Sizzle. Join your home Wi-Fi or turn on Tailscale, then check the address in the
              Shortcut matches one above.
            </Trouble>
            <Trouble problem="It says saved, but nothing appears in Imports">
              Check that Method is POST, Request Body is JSON and the field is named <code className={code}>text</code>
              {token_required ? ', and that the Authorization header has the right token' : ''}.
            </Trouble>
          </dl>
        </section>
      </div>

      <section aria-labelledby="script-heading" className={`mt-6 ${minorCard}`}>
        <h2 id="script-heading" className="font-display text-xl font-semibold">
          From a computer
        </h2>
        <p className="mt-4 text-sm text-graphite">
          The same endpoint works from scripts. Send a link or the recipe text:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-2xl bg-porcelain p-4 text-xs sm:text-sm">
          {`curl -X POST ${endpoint} \\
  -H 'Content-Type: application/json' \\${token_required ? "\n  -H 'Authorization: Bearer $SIZZLE_API_TOKEN' \\" : ''}
  -d '{"url": "https://example.com/best-lasagna"}'`}
        </pre>
      </section>
    </div>
  )
}

ShareShow.layout = AppLayout

function ShortcutUrl({ endpoint, endpoints }: { endpoint: string; endpoints: ShortcutEndpoint[] }) {
  if (endpoints.length === 0) {
    const example = new URL(endpoint)
    example.hostname = '192.168.1.20'

    return (
      <>
        <p>
          Add a <strong>Get Contents of URL</strong> action with your server’s network address followed by{' '}
          <code className={code}>/api/imports</code>, for example <code className={code}>{example.href}</code>.
        </p>
        <p className="mt-3 text-sm text-graphite">
          You opened Sizzle through localhost, which your phone can’t reach. Open it by the server’s address instead and
          this page will show the exact URL.
        </p>
      </>
    )
  }

  return (
    <>
      <p>
        Add a <strong>Get Contents of URL</strong> action with{' '}
        {endpoints.length === 1 ? 'this URL:' : 'one of these URLs:'}
      </p>
      {endpoints.map(({ url, network }) => (
        <div key={url} className="mt-3">
          {network && <p className="mb-1.5 text-sm text-graphite">{NETWORK_LABELS[network]}</p>}
          <CopyField value={url} />
        </div>
      ))}
    </>
  )
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[1.75rem_1fr] gap-x-4">
      <span
        aria-hidden="true"
        className="flex size-7 items-center justify-center rounded-full bg-yolk-soft text-xs font-semibold"
      >
        {number}
      </span>
      <div className="min-w-0">
        <h3 className="font-semibold">{title}</h3>
        <div className="mt-1 text-graphite [&_strong]:text-ink">{children}</div>
      </div>
    </li>
  )
}

function Trouble({ problem, children }: { problem: string; children: ReactNode }) {
  return (
    <div>
      <dt className="font-medium">{problem}</dt>
      <dd className="mt-1 text-graphite">{children}</dd>
    </div>
  )
}

function Status({ done, children }: { done: boolean; children: ReactNode }) {
  return (
    <p role="status" className="mt-6 flex items-center gap-3 rounded-2xl bg-porcelain p-4 text-sm font-medium">
      <span
        className={`flex size-7 shrink-0 items-center justify-center rounded-full ${done ? 'bg-yolk text-[#18181b]' : 'ring-1 ring-hairline'}`}
      >
        {done ? <Icon name="check" className="size-4" /> : '—'}
      </span>
      {children}
    </p>
  )
}

function CopyField({ value }: { value: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  return (
    <div className="flex items-center gap-2 rounded-2xl bg-porcelain py-1.5 pr-1.5 pl-4 ring-1 ring-hairline">
      <code className="min-w-0 flex-1 truncate text-sm select-all">{value}</code>
      <button
        type="button"
        onClick={() => {
          void copyText(value).then((copied) => setState(copied ? 'copied' : 'failed'))
        }}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-yolk px-4 py-2 text-sm font-semibold text-[#18181b] hover:brightness-95"
      >
        {state === 'copied' && <Icon name="check" className="size-4" />}
        <span aria-live="polite">{{ idle: 'Copy', copied: 'Copied', failed: 'Copy failed' }[state]}</span>
      </button>
    </div>
  )
}
