import { Head, Link, usePoll } from '@inertiajs/react'
import { useEffect } from 'react'
import FilterBar from '@/components/FilterBar'
import ImportStatusLabel from '@/components/ImportStatusLabel'
import RecipeTile from '@/components/RecipeTile'
import UrlImportForm from '@/components/UrlImportForm'
import AppLayout from '@/layouts/AppLayout'
import type { Facets, Import, RecipeCard, RecipeFilters } from '@/types'

type Props = {
  recipes: RecipeCard[]
  page: number
  has_more: boolean
  filters: RecipeFilters
  facets: Facets
  total_count: number
  pending_imports: Import[]
  failed_imports: Import[]
}

export default function RecipesIndex({
  recipes,
  page,
  has_more,
  filters,
  facets,
  total_count,
  pending_imports,
  failed_imports,
}: Props) {
  const { start, stop } = usePoll(
    2500,
    { only: ['recipes', 'pending_imports', 'failed_imports', 'facets', 'total_count', 'has_more'] },
    { autoStart: false },
  )
  const pending = pending_imports.length > 0

  useEffect(() => {
    if (pending) start()
    else stop()
    return stop
  }, [pending, start, stop])

  const filtered = Object.values(filters).some(Boolean)

  return (
    <>
      <Head title="Sizzle" />
      <div className="mb-8 flex items-baseline justify-between gap-4">
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">Your cookbook</h1>
        <p className="text-sm text-graphite">
          {total_count} {total_count === 1 ? 'recipe' : 'recipes'}
        </p>
      </div>

      <UrlImportForm />

      {failed_imports.length > 0 && (
        <section aria-label="Failed imports" className="mb-8 rounded-photo bg-paper p-4 ring-1 ring-hairline">
          {failed_imports.map((item) => (
            <div key={item.id} className="mb-3 last:mb-0" role="alert">
              <p className="truncate text-sm font-medium">{item.url ?? 'Pasted recipe'}</p>
              <p className="mt-1 text-sm text-danger">{item.error ?? 'Couldn’t import this recipe.'}</p>
            </div>
          ))}
          <Link href="/imports" className="text-sm underline underline-offset-4">
            View imports and retry
          </Link>
        </section>
      )}

      {total_count === 0 && !pending ? (
        <EmptyCookbook />
      ) : (
        <>
          <FilterBar filters={filters} facets={facets} />

          <section
            aria-label="Recipes"
            className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4"
          >
            {page === 1 && pending_imports.map((item) => <PendingTile key={item.id} item={item} />)}
            {recipes.map((recipe) => (
              <RecipeTile key={recipe.id} recipe={recipe} />
            ))}
          </section>

          {recipes.length === 0 && filtered && (
            <p className="mt-16 text-center text-graphite">No recipes match those filters.</p>
          )}
        </>
      )}

      {(page > 1 || has_more) && (
        <nav className="mt-12 flex justify-center gap-3" aria-label="Pages">
          {page > 1 && <PageLink filters={filters} page={page - 1} label="Newer" />}
          {has_more && <PageLink filters={filters} page={page + 1} label="Older" />}
        </nav>
      )}
    </>
  )
}

RecipesIndex.layout = AppLayout

function PendingTile({ item }: { item: Import }) {
  return (
    <div role="status">
      <div className="aspect-[4/5] animate-pulse rounded-photo bg-hairline" />
      <p className="mt-3 truncate font-display text-lg font-semibold text-graphite">
        {item.url ? new URL(item.url).hostname.replace(/^www\./, '') : 'Pasted recipe'}
      </p>
      <ImportStatusLabel status={item.status} />
    </div>
  )
}

function PageLink({ filters, page, label }: { filters: RecipeFilters; page: number; label: string }) {
  return (
    <Link
      href="/"
      data={{ ...filters, page }}
      preserveScroll={false}
      className="rounded-full bg-paper px-5 py-2 text-sm ring-1 ring-hairline hover:ring-ink/30"
    >
      {label}
    </Link>
  )
}

function EmptyCookbook() {
  return (
    <div className="mx-auto max-w-xl py-16 sm:py-24">
      <h2 className="font-display text-5xl leading-[0.95] font-semibold text-balance sm:text-7xl">
        Every recipe you love, minus the life story.
      </h2>
      <p className="mt-6 text-lg text-graphite">
        Share a recipe page from your phone or paste a link. Sizzle keeps the ingredients, the steps and the best photo,
        and drops the ads and the scrolling.
      </p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/setup" className="rounded-full bg-yolk px-5 py-3 font-semibold text-[#18181b] hover:brightness-95">
          Set up Sizzle
        </Link>
        <Link href="/imports" className="rounded-full px-5 py-3 ring-1 ring-hairline hover:ring-ink/30">
          Add your first recipe
        </Link>
        <Link href="/share" className="rounded-full px-5 py-3 ring-1 ring-hairline hover:ring-ink/30">
          Set up sharing from your phone
        </Link>
      </div>
    </div>
  )
}
