import { Link, router, usePage } from '@inertiajs/react'
import { useEffect, useState, type ReactNode } from 'react'
import Icon from '@/components/Icon'
import SizzleLogo from '@/components/SizzleLogo'
import { applyCustomThemes, rememberLook } from '@/lib/theme'

export default function AppLayout({ children }: { children: ReactNode }) {
  const { flash, url } = usePage()
  const message = flash.notice ?? flash.alert
  const [dismissed, setDismissed] = useState(false)

  // Every new flash shows again, even one with the same text as the last.
  useEffect(() => router.on('flash', () => setDismissed(false)), [])

  // The server renders the saved look on first load. Later server responses keep it in
  // step; history restores don't fire "success", so an old page can't bring back an old look.
  useEffect(
    () =>
      router.on('success', (event) => {
        applyCustomThemes(event.detail.page.props.theme_css)
        rememberLook(event.detail.page.props.appearance)
      }),
    [],
  )

  return (
    <div className="min-h-dvh pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-20 border-b border-hairline bg-porcelain/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="font-display text-[1.7rem] leading-none font-[750] tracking-[-0.045em]">
            <SizzleLogo />
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/setup"
              className="rounded-full px-3 py-2 text-sm text-graphite hover:text-ink"
              aria-current={url.startsWith('/setup') ? 'page' : undefined}
            >
              Setup
            </Link>
            <Link
              href="/share"
              className={`hidden rounded-full px-3 py-2 text-sm text-graphite hover:text-ink sm:block ${url.startsWith('/share') ? 'text-ink' : ''}`}
            >
              Share from your phone
            </Link>
            <Link
              href="/appearance"
              aria-label="Appearance"
              title="Appearance"
              aria-current={url.startsWith('/appearance') ? 'page' : undefined}
              className={`rounded-full p-2 hover:text-ink ${url.startsWith('/appearance') ? 'text-ink' : 'text-graphite'}`}
            >
              <Icon name="appearance" className="size-5" />
            </Link>
            <Link
              href="/imports"
              className="inline-flex items-center gap-1.5 rounded-full bg-action px-4 py-2 text-sm font-semibold text-on-action hover:brightness-95"
            >
              <Icon name="plus" className="size-4" />
              Add recipe
            </Link>
          </nav>
        </div>
      </header>

      {message && !dismissed && (
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6" role="status">
          <div
            className={`flex items-start justify-between gap-3 rounded-2xl px-4 py-3 text-sm ${flash.alert ? 'bg-danger/10 text-danger' : 'bg-paper text-ink ring-1 ring-hairline'}`}
          >
            <p>{message}</p>
            <button type="button" onClick={() => setDismissed(true)} aria-label="Dismiss" className="text-graphite">
              <Icon name="close" className="size-4" />
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 pt-6 pb-24 sm:px-6 sm:pt-10">{children}</main>
    </div>
  )
}
