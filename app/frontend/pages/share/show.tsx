import { Head } from '@inertiajs/react'
import { useState } from 'react'
import AppLayout from '@/layouts/AppLayout'

type Props = { endpoint: string; token_required: boolean }

export default function ShareShow({ endpoint, token_required }: Props) {
  return (
    <div className="mx-auto max-w-2xl">
      <Head title="Share from your phone" />
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">Share from your phone</h1>
      <p className="mt-3 text-graphite">
        Add Sizzle to your iPhone’s share sheet with a two-minute Shortcut. Then, on any recipe page, tap Share and
        choose Save to Sizzle.
      </p>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">Build the Shortcut</h2>
        <ol className="mt-4 list-decimal space-y-4 pl-5 marker:font-display marker:font-semibold marker:text-graphite">
          <li>Open the Shortcuts app and tap + to create a new shortcut. Name it “Save to Sizzle”.</li>
          <li>
            Tap the info button, turn on <strong>Show in Share Sheet</strong>, and set it to receive{' '}
            <strong>URLs</strong> and <strong>Text</strong>.
          </li>
          <li>
            Add the <strong>Get Contents of URL</strong> action with this URL:
            <CopyField value={endpoint} />
            Set Method to <strong>POST</strong> and Request Body to <strong>JSON</strong>, with a text field named{' '}
            <code className="rounded bg-paper px-1.5 py-0.5 text-sm ring-1 ring-hairline">url</code> set to{' '}
            <strong>Shortcut Input</strong>.
          </li>
          {token_required && (
            <li>
              Under Headers, add{' '}
              <code className="rounded bg-paper px-1.5 py-0.5 text-sm ring-1 ring-hairline">Authorization</code> with
              the value <code className="rounded bg-paper px-1.5 py-0.5 text-sm ring-1 ring-hairline">Bearer</code>{' '}
              followed by a space and the value of SIZZLE_API_TOKEN from your server’s configuration.
            </li>
          )}
          <li>
            Add a <strong>Show Notification</strong> action saying “Saved to Sizzle”.
          </li>
        </ol>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">Your phone needs to reach this server</h2>
        <p className="mt-3 text-graphite">
          The Shortcut sends links straight to this address, so your phone has to be able to reach it: on your home
          Wi-Fi, or anywhere through a private network like Tailscale or WireGuard. Don’t put Sizzle on the open
          internet without a SIZZLE_API_TOKEN and a login in front of it.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">From a computer</h2>
        <p className="mt-3 text-graphite">The same endpoint works from scripts:</p>
        <pre className="mt-3 overflow-x-auto rounded-2xl bg-paper p-4 text-sm ring-1 ring-hairline">
          {`curl -X POST ${endpoint} \\
  -H 'Content-Type: application/json' \\${token_required ? "\n  -H 'Authorization: Bearer $SIZZLE_API_TOKEN' \\" : ''}
  -d '{"url": "https://example.com/best-lasagna"}'`}
        </pre>
      </section>
    </div>
  )
}

ShareShow.layout = AppLayout

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <span className="my-2 flex items-center gap-2 rounded-2xl bg-paper py-1 pr-1 pl-4 ring-1 ring-hairline">
      <code className="min-w-0 flex-1 truncate text-sm">{value}</code>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(() => setCopied(true))
        }}
        className="shrink-0 rounded-full bg-yolk px-3 py-1.5 text-sm font-medium text-[#18181b]"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  )
}
