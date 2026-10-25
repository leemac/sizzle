import { Link, router, usePage } from '@inertiajs/react'
import { useEffect, useState, type ReactNode } from 'react'
import FailedImportsLink from '@/components/FailedImportsLink'
import Icon from '@/components/Icon'
import SizzleLogo from '@/components/SizzleLogo'
import SosButton from '@/components/SosButton'
import { applyCustomThemes, rememberLook } from '@/lib/theme'
import type { RecipeFilters } from '@/types'

export default function AppLayout({ children }: { children: ReactNode }) {
  const { flash, url, props, component } = usePage()
  const inGallery = component === 'recipes/index'
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
    <div className="flex min-h-dvh flex-col pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-20 border-b border-hairline bg-porcelain/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-[0.3em] font-display text-[1.7rem] leading-none font-[750] tracking-[-0.045em]"
          >
            <img src="/icon.svg" alt="" width={32} height={32} className="size-[1.15em] shrink-0" />
            <SizzleLogo />
          </Link>
          {/* Appearance and sharing from your phone live in Settings, so the header keeps
              one main action and a few quiet ones. */}
          <nav className="flex items-center gap-1">
            <SosButton filters={inGallery ? (props.filters as RecipeFilters) : {}} inGallery={inGallery} />
            <FailedImportsLink count={props.failed_import_count} />
            <Link
              href="/settings"
              aria-label="Settings"
              title="Settings"
              aria-current={url.startsWith('/settings') ? 'page' : undefined}
              className={`rounded-full p-2 hover:text-ink ${url.startsWith('/settings') ? 'text-ink' : 'text-graphite'}`}
            >
              <Icon name="settings" className="size-5" />
            </Link>
            {/* Phones only have room for the icon, like the SOS button. */}
            <Link
              href="/imports"
              className="ml-1 inline-flex shrink-0 items-center sm:ml-2 gap-1.5 rounded-full bg-action p-2 text-sm font-semibold text-on-action hover:brightness-95 sm:px-4"
            >
              <Icon name="plus" className="size-5 sm:size-4" />
              <span className="sr-only sm:not-sr-only">Add recipe</span>
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

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-24 sm:px-6 sm:pt-10">{children}</main>
      <footer className="mx-auto flex w-full max-w-7xl items-center gap-2 px-4 pb-6 text-xs text-graphite sm:px-6">
        <a
          href={
            props.app.version === 'dev'
              ? 'https://github.com/leemac/sizzle'
              : `https://github.com/leemac/sizzle/releases/tag/${encodeURIComponent(`v${props.app.version}`)}`
          }
          target="_blank"
          rel="noreferrer"
          aria-label={
            props.app.version === 'dev' ? 'View Sizzle on GitHub' : `View release notes for Sizzle ${props.app.version}`
          }
          className="footer-link"
        >
          Sizzle {props.app.version === 'dev' ? 'dev' : `v${props.app.version}`}
        </a>
        <span aria-hidden="true">·</span>
        <a href="https://mckinnon.dev" target="_blank" rel="noreferrer" className="footer-link">
          By Lee
        </a>
      </footer>
    </div>
  )
}
