import { Link, usePage } from '@inertiajs/react'
import Icon from '@/components/Icon'
import AppLayout from '@/layouts/AppLayout'
import type { Release } from '@/types'

const dateFormat = new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

export default function ReleasesIndex({ releases }: { releases: Release[] }) {
  const { app } = usePage().props
  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-graphite hover:text-ink">
        <Icon name="back" className="size-4" /> Back to the cookbook
      </Link>

      <div className="mt-6 flex items-center gap-3 rounded-xl border border-active/30 bg-mark px-4 py-3 text-sm font-semibold text-ink">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5 shrink-0 text-active">
          <path d="M5 15v6M19 15v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <rect x="2" y="5" width="20" height="10" rx="2" fill="currentColor" />
          <path d="m7 6-4 8m10-8-4 8m10-8-4 8" stroke="var(--color-on-active)" strokeWidth="2" />
        </svg>
        Under construction
      </div>

      <header className="relative mt-8 mb-8 grid items-center gap-8 border-b border-hairline pb-8 sm:grid-cols-[1fr_10rem]">
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">Release notes</h1>
        <div
          aria-hidden="true"
          className="release-receipt relative hidden rotate-3 rounded-t-xl border border-hairline bg-paper px-4 pt-4 pb-5 text-center shadow-sm sm:block"
        >
          <svg
            viewBox="0 0 120 85"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="mx-auto mb-4 h-20 w-28 text-ink"
          >
            <path d="M29 45h64v11c0 15-12 24-27 24H56c-15 0-27-9-27-24V45ZM29 51H13a7 7 0 0 0 0 14h18M93 51h14" />
            <path d="M25 40h72M52 36c0-5 18-5 18 0" />
            <g className="release-steam text-active" stroke="currentColor">
              <path d="M45 27c-9-8 8-10 0-19M61 24c-9-8 8-10 0-19M77 27c-9-8 8-10 0-19" />
            </g>
          </svg>
          <div className="mt-4 border-t border-dashed border-hairline pt-3 font-mono text-xs text-graphite">
            {app.version === 'dev' ? 'Development build' : `Your version · ${app.version}`}
          </div>
        </div>
      </header>

      {releases.length > 0 ? (
        <div className="grid gap-8 md:grid-cols-[9rem_minmax(0,1fr)] md:gap-10">
          <aside>
            <nav aria-label="Release history" className="md:sticky md:top-24">
              <h2 className="mb-3 text-xs font-medium tracking-widest text-graphite uppercase">Versions</h2>
              <ol className="flex flex-wrap gap-2 md:flex-col md:gap-0">
                {releases.map((release, index) => (
                  <li key={release.version}>
                    <a
                      href={`#v${release.version}`}
                      className="group flex items-center gap-2 rounded-full px-3 py-2 text-sm text-graphite hover:bg-paper hover:text-ink md:-ml-3"
                    >
                      <span
                        aria-hidden="true"
                        className={`size-1.5 rounded-full ${index === 0 ? 'bg-active' : 'bg-hairline group-hover:bg-graphite'}`}
                      />
                      v{release.version}
                      {release.version === app.version && <span className="sr-only"> — your version</span>}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>

          <div className="min-w-0 space-y-10">
            {releases.map((release, index) => (
              <article
                key={release.version}
                id={`v${release.version}`}
                className="release-entry scroll-mt-24 rounded-2xl border border-hairline bg-paper p-5 sm:p-8"
              >
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-xs">
                    <h2 className="rounded-full bg-mark px-3 py-1 font-mono font-medium text-ink">
                      v{release.version}
                    </h2>
                    <time dateTime={release.date} className="text-graphite">
                      {dateFormat.format(new Date(`${release.date}T12:00:00Z`))}
                    </time>
                    {release.version === app.version && (
                      <span className="inline-flex items-center gap-1 text-graphite">
                        <Icon name="check" className="size-3" /> Your version
                      </span>
                    )}
                  </div>
                  {index === 0 && (
                    <span
                      title="Latest release in this build"
                      className="shrink-0 rounded-full bg-active px-3 py-1 text-xs font-semibold text-on-active"
                    >
                      Latest
                    </span>
                  )}
                </div>
                <details open={index === 0} className="group border-t border-hairline pt-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-sm py-1 text-sm font-medium [&::-webkit-details-marker]:hidden">
                    Release notes <Icon name="plus" className="size-4 shrink-0 group-open:rotate-45" />
                  </summary>
                  <div className="mt-5 space-y-6 text-sm leading-relaxed break-words">
                    {release.sections.map((section) => (
                      <section key={section.title}>
                        <h3 className="mb-2 font-semibold">{section.title}</h3>
                        <div className="space-y-3 text-graphite">
                          {section.paragraphs.map((paragraph, i) => (
                            <p key={i}>{paragraph}</p>
                          ))}
                        </div>
                      </section>
                    ))}
                    <a
                      href={release.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 underline decoration-hairline underline-offset-4 hover:decoration-ink"
                    >
                      Original release &amp; pull requests <Icon name="external" className="size-3.5" />
                    </a>
                  </div>
                </details>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <p className="rounded-2xl border border-hairline bg-paper p-6 text-graphite">
          No release notes are bundled for this version yet.
        </p>
      )}
    </div>
  )
}

ReleasesIndex.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>
