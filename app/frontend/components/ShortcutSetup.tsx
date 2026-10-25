import { router } from '@inertiajs/react'
import { useEffect, useState } from 'react'

export type ShortcutPairing = {
  download_url: string
  shortcut_name: string
  connections: { id: number; name: string; connected: boolean }[]
}

const button =
  'inline-flex min-h-11 items-center justify-center rounded-full px-5 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink'

export default function ShortcutSetup({ download_url, shortcut_name, connections }: ShortcutPairing) {
  const [name, setName] = useState('My iPhone')
  const [busy, setBusy] = useState(false)
  const [connectUrl, setConnectUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const refresh = () => router.reload({ only: ['shortcut_pairing'] })
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])

  const connect = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setConnectUrl(null)
    try {
      const response = await fetch('/share/connections', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-CSRF-Token': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '',
        },
        body: JSON.stringify({ name }),
      })
      const data = await response.json()
      if (!response.ok || typeof data.connect_url !== 'string' || !data.connect_url.startsWith('shortcuts://')) {
        setError(data.error ?? 'Could not start the connection. Try again.')
      } else {
        setConnectUrl(data.connect_url)
      }
    } catch {
      setError('Could not reach Sizzle. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="shortcut-heading" className="mt-8 rounded-photo bg-paper p-5 ring-1 ring-hairline sm:p-8">
      <h2 id="shortcut-heading" className="font-display text-3xl font-semibold">
        Save to Sizzle
      </h2>
      <p className="mt-3 text-graphite">
        Add the iPhone shortcut, then connect it to this cookbook. No API key to copy.
      </p>
      <ol className="mt-7 space-y-7">
        <li>
          <h3 className="text-lg font-semibold">1. Add the shortcut</h3>
          <p className="mt-2 text-sm text-graphite">
            Save the download, open it in Files and add <strong className="text-ink">{shortcut_name}</strong> in
            Shortcuts. Then return here to connect it.
          </p>
          <a href={download_url} className={`${button} mt-4 bg-action text-on-action`}>
            Download shortcut
          </a>
        </li>
        <li>
          <h3 className="text-lg font-semibold">2. Connect to this cookbook</h3>
          <p className="mt-2 text-sm text-graphite">Give this connection a name so you can disconnect it later.</p>
          <form onSubmit={connect} className="mt-4 flex flex-wrap items-end gap-3" aria-busy={busy}>
            <div className="min-w-0 flex-1 basis-48">
              <label htmlFor="shortcut-name" className="text-sm font-medium">
                Connection name
              </label>
              <input
                id="shortcut-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={60}
                className="mt-2 block w-full rounded-xl border-hairline bg-porcelain px-4 py-3 focus:border-ink focus:ring-0"
              />
            </div>
            <button disabled={busy} className={`${button} bg-action text-on-action disabled:opacity-50`}>
              {busy ? 'Preparing…' : 'Connect shortcut'}
            </button>
          </form>
          {error && (
            <p role="alert" className="mt-3 text-sm">
              {error}
            </p>
          )}
          {connectUrl && (
            <div role="status" className="mt-4 rounded-xl bg-porcelain p-4 ring-1 ring-hairline">
              <a href={connectUrl} className={`${button} bg-active text-on-active`}>
                Open Shortcuts to connect
              </a>
              <p className="mt-3 text-sm text-graphite">
                This link works once and expires in five minutes. Allow Shortcuts to save the connection and contact
                your server when asked.
              </p>
            </div>
          )}
        </li>
      </ol>
      <p className="mt-7 border-t border-hairline pt-5 text-sm text-graphite">
        Then open a recipe, tap Share and choose {shortcut_name}. “Sent to Sizzle” means the import was accepted;
        processing continues in your cookbook.
      </p>
      <div className="mt-7 border-t border-hairline pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">Your connections</h3>
          <button
            type="button"
            onClick={() => router.reload({ only: ['shortcut_pairing'] })}
            className={`${button} ring-1 ring-hairline`}
          >
            Check connection
          </button>
        </div>
        {connections.length === 0 ? (
          <p className="mt-3 text-sm text-graphite">No shortcuts connected yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-hairline">
            {connections.map((connection) => (
              <li key={connection.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium break-words">{connection.name}</p>
                  <p className="text-sm text-graphite">{connection.connected ? 'Connected' : 'Waiting to connect'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => router.delete(`/share/connections/${connection.id}`, { preserveScroll: true })}
                  className={`${button} ring-1 ring-hairline`}
                >
                  {connection.connected ? 'Disconnect' : 'Cancel connection'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
