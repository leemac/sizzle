import { Head, Link } from '@inertiajs/react'
import { useState, type ReactNode } from 'react'
import Icon from '@/components/Icon'
import Tabs from '@/components/Tabs'
import AppLayout from '@/layouts/AppLayout'
import { copyText } from '@/lib/clipboard'
import { isTailscaleHost } from '@/lib/network'
import { detectPlatform } from '@/lib/platform'

type ShortcutEndpoint = { url: string; network: 'home' | 'tailscale' | null }

type Props = { endpoint: string; shortcut_endpoints: ShortcutEndpoint[]; token_required: boolean }

const NETWORK_LABELS = { home: 'On your home Wi-Fi', tailscale: 'Through Tailscale, at home or away' }

const card = 'rounded-photo bg-paper p-5 ring-1 ring-hairline sm:p-8'
const minorCard = 'rounded-photo bg-paper p-5 ring-1 ring-hairline sm:p-6'
const code = 'rounded-md bg-porcelain px-1.5 py-0.5 text-[0.9em] ring-1 ring-hairline'
const button =
  'inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm ring-1 ring-hairline hover:ring-ink/30'

export default function ShareShow({ endpoint, shortcut_endpoints, token_required }: Props) {
  const tailscaleOnServer = shortcut_endpoints.some(({ network }) => network === 'tailscale')
  const viaTailscale = isTailscaleHost(new URL(endpoint).hostname)

  return (
    <div className="mx-auto max-w-3xl">
      <Head title="Share from your phone" />
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">Share from your phone</h1>
      <p className="mt-4 max-w-xl text-graphite">
        Save recipes from your phone’s share sheet, or from a script on your computer. Set it up once, then it’s a tap.
      </p>

      <section aria-labelledby="address-heading" className={`mt-8 ${card}`}>
        <h2 id="address-heading" className="font-display text-2xl font-semibold">
          Your Sizzle address
        </h2>
        <p className="mt-2 text-sm text-graphite">Every way of sharing below sends recipes here.</p>
        <ShortcutUrl endpoint={endpoint} endpoints={shortcut_endpoints} />
      </section>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <section aria-labelledby="away-heading" className={minorCard}>
          <h2 id="away-heading" className="font-display text-xl font-semibold">
            Away from home
          </h2>
          <p className="mt-2 text-sm text-graphite">
            Your phone reaches Sizzle on your home Wi-Fi. Everywhere else, use{' '}
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
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-graphite marker:font-semibold">
            <li>Install it on this server and your phone, signed in to the same account.</li>
            <li>Open Sizzle on your phone by the server’s Tailscale name. The address above will use it.</li>
            <li>Leave Tailscale Funnel off. It would put Sizzle on the open internet.</li>
          </ol>
          <div className="mt-5 flex flex-wrap gap-2">
            <ExternalLink href="https://tailscale.com/download">Get Tailscale</ExternalLink>
            <ExternalLink href="https://tailscale.com/kb/1081/magicdns">How server names work</ExternalLink>
          </div>
        </section>

        <section aria-labelledby="private-heading" className={minorCard}>
          <h2 id="private-heading" className="font-display text-xl font-semibold">
            Who can add recipes
          </h2>
          <Status done={token_required}>
            {token_required ? 'Shares need your API token' : 'Anyone who can reach this server can add recipes'}
          </Status>
          <p className="mt-4 text-sm text-graphite">
            {token_required
              ? 'Each method below sends the token with every share. Requests without it are refused.'
              : 'That’s fine on a home network you trust. To require a token, set SIZZLE_API_TOKEN in your server’s .env file and restart Sizzle.'}{' '}
            Don’t put Sizzle on the open internet: it has no login yet.
          </p>
        </section>
      </div>

      <section aria-labelledby="methods-heading" className="mt-12">
        <h2 id="methods-heading" className="font-display text-3xl font-semibold">
          Set up sharing
        </h2>
        <div className="mt-5">
          <Tabs
            label="Share from"
            initial={detectPlatform(navigator.userAgent)}
            tabs={[
              { id: 'ios', label: 'iPhone and iPad', content: <IosSetup tokenRequired={token_required} /> },
              { id: 'android', label: 'Android', content: <AndroidSetup tokenRequired={token_required} /> },
              {
                id: 'computer',
                label: 'Computer',
                content: <ComputerSetup endpoint={endpoint} tokenRequired={token_required} />,
              },
            ]}
          />
        </div>
      </section>
    </div>
  )
}

ShareShow.layout = AppLayout

function IosSetup({ tokenRequired }: { tokenRequired: boolean }) {
  return (
    <div className={card}>
      <h3 className="font-display text-2xl font-semibold">Build the Shortcut</h3>
      <p className="mt-2 text-sm text-graphite">Uses the Shortcuts app that comes with iOS. Takes about two minutes.</p>
      <ol className="mt-6 space-y-7">
        <Step number={1} title="Create it">
          Open the Shortcuts app, tap <strong>+</strong> and name the shortcut “Save to Sizzle”.
        </Step>
        <Step number={2} title="Put it in the share sheet">
          Tap the info button, turn on <strong>Show in Share Sheet</strong>, and set it to receive <strong>URLs</strong>{' '}
          and <strong>Text</strong>.
        </Step>
        <Step number={3} title="Send what you share to Sizzle">
          Add a <strong>Get Contents of URL</strong> action with your Sizzle address, tap <strong>Show More</strong> and
          set:
          <Settings>
            <Setting name="Method">POST</Setting>
            <Setting name="Request Body">JSON</Setting>
            <Setting name="Field">
              A Text field named <code className={code}>text</code>, set to <strong>Shortcut Input</strong>
            </Setting>
            {tokenRequired && (
              <Setting name="Header">
                <code className={code}>Authorization</code>, set to <code className={code}>Bearer</code>, a space, then
                your SIZZLE_API_TOKEN
              </Setting>
            )}
          </Settings>
          <p className="mt-3 text-sm">Sizzle works out whether you shared a link or the recipe itself.</p>
        </Step>
        <Step number={4} title="Know it worked">
          Add a <strong>Show Notification</strong> action saying “Saved to Sizzle”.
        </Step>
      </ol>
      <TryIt>Open a recipe in Safari, tap Share and choose Save to Sizzle.</TryIt>
      <Troubleshooting>
        <Trouble problem="“Could not connect to the server”">
          Your phone can’t reach Sizzle. Join your home Wi-Fi or turn on Tailscale, then check the URL in the Shortcut
          matches your Sizzle address.
        </Trouble>
        <Trouble problem="It says saved, but nothing appears in Imports">
          The Shortcut shows its notification even when Sizzle turns the request down. Check that Method is POST,
          Request Body is JSON and the field is named <code className={code}>text</code>
          {tokenRequired ? ', and that the Authorization header has the right token' : ''}.
        </Trouble>
      </Troubleshooting>
    </div>
  )
}

function AndroidSetup({ tokenRequired }: { tokenRequired: boolean }) {
  return (
    <div className={card}>
      <h3 className="font-display text-2xl font-semibold">Set up HTTP Shortcuts</h3>
      <p className="mt-2 text-sm text-graphite">
        Android has no built-in Shortcuts app, so use HTTP Shortcuts: free, open source and with no account. It adds
        Sizzle to your share sheet. Takes about five minutes.
      </p>
      <ol className="mt-6 space-y-7">
        <Step number={1} title="Install HTTP Shortcuts">
          Get it from Google Play or F-Droid.
          <div className="mt-3 flex flex-wrap gap-2">
            <ExternalLink href="https://play.google.com/store/apps/details?id=ch.rmy.android.http_shortcuts">
              Google Play
            </ExternalLink>
            <ExternalLink href="https://f-droid.org/packages/ch.rmy.android.http_shortcuts/">F-Droid</ExternalLink>
          </div>
        </Step>
        <Step number={2} title="Make a variable for what you share">
          From the app’s menu, open <strong>Global Variables</strong>, tap <strong>+</strong> and choose{' '}
          <strong>Static Variable</strong>. Name it <code className={code}>shared</code>, then turn on{' '}
          <strong>Allow Receiving Value from Share Dialog</strong> and <strong>JSON encode</strong>.
        </Step>
        <Step number={3} title="Create the shortcut">
          Tap <strong>+</strong>, choose <strong>Regular HTTP Shortcut</strong> and name it “Save to Sizzle”. Under{' '}
          <strong>Basic Request Settings</strong>, set:
          <Settings>
            <Setting name="Method">POST</Setting>
            <Setting name="URL">Your Sizzle address</Setting>
          </Settings>
        </Step>
        <Step number={4} title="Send what you share to Sizzle">
          Under <strong>Request Body / Parameters</strong>, set:
          <Settings>
            <Setting name="Request Body Type">Custom Text</Setting>
            <Setting name="Content-Type">
              <code className={code}>application/json</code>
            </Setting>
            <Setting name="Body">
              <code className={code}>{'{"text": "{shared}"}'}</code>
            </Setting>
          </Settings>
          <p className="mt-3 text-sm">
            Type the quotes and brackets yourself, then put <code className={code}>shared</code> between the inner
            quotes with the <strong>{'{ }'}</strong> button.
          </p>
          {tokenRequired && (
            <p className="mt-3 text-sm">
              Under <strong>Request Headers</strong>, add <code className={code}>Authorization</code> set to{' '}
              <code className={code}>Bearer</code>, a space, then your SIZZLE_API_TOKEN.
            </p>
          )}
        </Step>
        <Step number={5} title="Know it worked">
          Under <strong>Response Handling</strong>, choose <strong>Show a custom message</strong> and enter “Saved to
          Sizzle”. If Sizzle turns a share down, the app shows the error instead.
        </Step>
      </ol>
      <TryIt>
        Open a recipe in Chrome, tap Share and choose HTTP Shortcuts. To see Save to Sizzle directly in the share sheet,
        turn on <strong className="text-ink">Show as app shortcut on launcher</strong> in the shortcut’s Trigger &amp;
        Execution Settings.
      </TryIt>
      <Troubleshooting>
        <Trouble problem="A connection error">
          Your phone can’t reach Sizzle. Join your home Wi-Fi or turn on Tailscale, then check the URL matches your
          Sizzle address.
        </Trouble>
        <Trouble problem="An error mentioning 400 or 415">
          The body isn’t JSON Sizzle can read. Check the Content-Type is <code className={code}>application/json</code>{' '}
          and that <strong className="text-ink">JSON encode</strong> is on for the <code className={code}>shared</code>{' '}
          variable.
        </Trouble>
        {tokenRequired && (
          <Trouble problem="An error mentioning 401">
            The Authorization header is missing or the token doesn’t match SIZZLE_API_TOKEN.
          </Trouble>
        )}
      </Troubleshooting>
    </div>
  )
}

function ComputerSetup({ endpoint, tokenRequired }: { endpoint: string; tokenRequired: boolean }) {
  const command = `curl -X POST ${endpoint} \\
  -H 'Content-Type: application/json' \\${tokenRequired ? "\n  -H 'Authorization: Bearer $SIZZLE_API_TOKEN' \\" : ''}
  -d '{"url": "https://example.com/best-lasagna"}'`

  return (
    <div className={card}>
      <h3 className="font-display text-2xl font-semibold">From a computer</h3>
      <p className="mt-2 text-graphite">
        In a browser, use Add recipe to paste a link or a whole recipe. No setup needed.
      </p>
      <Link href="/imports" className={`mt-4 ${button}`}>
        <Icon name="plus" className="size-4" />
        Add recipe
      </Link>

      <div className="mt-8 border-t border-hairline pt-6">
        <h4 className="font-display text-xl font-semibold">From scripts and other apps</h4>
        <p className="mt-2 text-sm text-graphite">
          Send JSON to your Sizzle address with a <code className={code}>url</code>, or the recipe itself as{' '}
          <code className={code}>text</code>. The import shows up in Imports.
        </p>
        <div className="relative mt-4">
          <pre className="overflow-x-auto rounded-2xl bg-porcelain p-4 pr-24 text-xs sm:text-sm">{command}</pre>
          <CopyButton value={command} className="absolute top-2 right-2" />
        </div>
      </div>
    </div>
  )
}

function ShortcutUrl({ endpoint, endpoints }: { endpoint: string; endpoints: ShortcutEndpoint[] }) {
  if (endpoints.length === 0) {
    const example = new URL(endpoint)
    example.hostname = '192.168.1.20'

    return (
      <div className="mt-4 text-sm text-graphite">
        <p>
          Use your server’s network address followed by <code className={code}>/api/imports</code>, for example{' '}
          <code className={code}>{example.href}</code>.
        </p>
        <p className="mt-2">
          You opened Sizzle through localhost, which your phone can’t reach. Open it by the server’s address instead and
          this page will show the exact URL.
        </p>
      </div>
    )
  }

  return endpoints.map(({ url, network }) => (
    <div key={url} className="mt-4">
      {network && <p className="mb-1.5 text-sm text-graphite">{NETWORK_LABELS[network]}</p>}
      <CopyField value={url} />
    </div>
  ))
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
        <p className="font-semibold">{title}</p>
        <div className="mt-1 text-graphite [&_strong]:text-ink">{children}</div>
      </div>
    </li>
  )
}

function Settings({ children }: { children: ReactNode }) {
  return <dl className="mt-3 space-y-3 rounded-2xl bg-porcelain p-4 text-sm sm:space-y-2">{children}</dl>
}

// Stacked on phones so long Shortcuts labels don't squeeze the values.
function Setting({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="sm:grid sm:grid-cols-[9.5rem_1fr] sm:gap-x-4">
      <dt className="text-graphite">{name}</dt>
      <dd className="mt-0.5 min-w-0 font-medium break-words text-ink sm:mt-0">{children}</dd>
    </div>
  )
}

function TryIt({ children }: { children: ReactNode }) {
  return (
    <div className="mt-8 border-t border-hairline pt-6">
      <h4 className="font-display text-xl font-semibold">Try it</h4>
      <p className="mt-2 text-sm text-graphite">
        {children} It shows up in Imports within a few seconds, then in your cookbook.
      </p>
      <Link href="/imports" className={`mt-4 ${button}`}>
        Open imports
      </Link>
    </div>
  )
}

function Troubleshooting({ children }: { children: ReactNode }) {
  return (
    <div className="mt-8 border-t border-hairline pt-6">
      <h4 className="font-display text-xl font-semibold">If it doesn’t work</h4>
      <dl className="mt-4 space-y-4 text-sm">{children}</dl>
    </div>
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
    <p role="status" className="mt-4 flex items-center gap-3 rounded-2xl bg-porcelain p-4 text-sm font-medium">
      <span
        className={`flex size-7 shrink-0 items-center justify-center rounded-full ${done ? 'bg-yolk text-[#18181b]' : 'ring-1 ring-hairline'}`}
      >
        {done ? <Icon name="check" className="size-4" /> : '—'}
      </span>
      {children}
    </p>
  )
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={button}>
      {children}
      <Icon name="external" className="size-4" />
    </a>
  )
}

function CopyField({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-porcelain py-1.5 pr-1.5 pl-4 ring-1 ring-hairline">
      <code className="min-w-0 flex-1 truncate text-sm select-all">{value}</code>
      <CopyButton value={value} />
    </div>
  )
}

function CopyButton({ value, className = '' }: { value: string; className?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  return (
    <button
      type="button"
      onClick={() => {
        void copyText(value).then((copied) => setState(copied ? 'copied' : 'failed'))
      }}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-yolk px-4 py-2 text-sm font-semibold text-[#18181b] hover:brightness-95 ${className}`}
    >
      {state === 'copied' && <Icon name="check" className="size-4" />}
      <span aria-live="polite">{{ idle: 'Copy', copied: 'Copied', failed: 'Copy failed' }[state]}</span>
    </button>
  )
}
