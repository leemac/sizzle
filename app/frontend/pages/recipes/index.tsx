import { Link, router, usePoll } from '@inertiajs/react'
import { useEffect } from 'react'
import FilterBar from '@/components/FilterBar'
import Icon, { type IconName } from '@/components/Icon'
import ImportStatusLabel from '@/components/ImportStatusLabel'
import LayoutToggle from '@/components/LayoutToggle'
import RecipeRow from '@/components/RecipeRow'
import RecipeTile from '@/components/RecipeTile'
import AppLayout from '@/layouts/AppLayout'
import { useGalleryLayout, type GalleryLayout } from '@/lib/galleryLayout'
import { RECIPE_SORTS } from '@/lib/recipeSort'
import type { Facets, Import, RecipeCard, RecipeFilters } from '@/types'

const GRIDS: Record<GalleryLayout, string> = {
  grid: 'grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4',
  list: 'grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3',
}

type Props = {
  recipes: RecipeCard[]
  page: number
  has_more: boolean
  filters: RecipeFilters
  sort: import('@/types').RecipeSort
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
  sort,
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
  const [layout, setLayout] = useGalleryLayout()

  useEffect(() => {
    if (pending) start()
    else stop()
    return stop
  }, [pending, start, stop])

  const filtered = Object.values(filters).some(Boolean)

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">Your cookbook</h1>
        {total_count > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-graphite">
              {total_count} {total_count === 1 ? 'recipe' : 'recipes'}
            </p>
            <LayoutToggle value={layout} onChange={setLayout} />
          </div>
        )}
      </div>

      {total_count > 0 && (
        <label className="mb-5 inline-flex items-center gap-3 text-sm text-graphite">
          Recipe order
          <select
            aria-label="Recipe order"
            value={sort}
            onChange={(event) =>
              router.patch(
                '/settings',
                { ...filters, preferences: { sort: event.target.value }, return_to: 'cookbook' },
                { preserveScroll: true },
              )
            }
            className="rounded-full border-hairline bg-paper py-2 pr-9 pl-4 text-sm text-ink focus:border-ink focus:ring-0"
          >
            {RECIPE_SORTS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}

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

          <section aria-label="Recipes" className={`mt-8 grid ${GRIDS[layout]}`}>
            {page === 1 && pending_imports.map((item) => <PendingTile key={item.id} item={item} layout={layout} />)}
            {recipes.map((recipe) =>
              layout === 'grid' ? (
                <RecipeTile key={recipe.id} recipe={recipe} />
              ) : (
                <RecipeRow key={recipe.id} recipe={recipe} />
              ),
            )}
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

const FIRST_STEPS: { href: string; icon: IconName; title: string; hint: string }[] = [
  { href: '/imports', icon: 'link', title: 'Import a link', hint: 'From a recipe site' },
  { href: '/imports?mode=manual', icon: 'edit', title: 'Write a recipe', hint: 'A family favourite' },
  { href: '/share', icon: 'share', title: 'Share from your phone', hint: 'Save as you browse' },
]

function EmptyCookbook() {
  return (
    <section aria-labelledby="empty-heading">
      <h2 id="empty-heading" className="text-graphite">
        No recipes yet.
      </h2>
      <ul className="mt-5 grid gap-3 sm:grid-cols-3 sm:gap-4">
        {FIRST_STEPS.map(({ href, icon, title, hint }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex h-full items-center gap-4 rounded-photo bg-paper p-4 ring-1 ring-hairline hover:ring-ink/30 sm:flex-col sm:items-start sm:p-5"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-mark">
                <Icon name={icon} className="size-5" />
              </span>
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="mt-0.5 block text-sm text-graphite">{hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function PendingTile({ item, layout }: { item: Import; layout: GalleryLayout }) {
  const label = item.url ? new URL(item.url).hostname.replace(/^www\./, '') : 'Pasted recipe'

  if (layout === 'list') {
    return (
      <div role="status" className="flex items-center gap-4 rounded-photo bg-paper p-2 pr-4 ring-1 ring-hairline">
        <div className="size-20 shrink-0 animate-pulse rounded-xl bg-hairline sm:size-24" />
        <div className="min-w-0">
          <p className="truncate font-display text-base font-semibold text-graphite">{label}</p>
          <ImportStatusLabel status={item.status} />
        </div>
      </div>
    )
  }

  return (
    <div role="status" className="relative aspect-[4/5] overflow-hidden rounded-photo">
      <div className="absolute inset-0 animate-pulse bg-hairline" />
      <div className="absolute inset-x-0 bottom-0 bg-paper/80 px-3 py-2.5 sm:px-4 sm:py-3">
        <p className="truncate font-display text-base font-semibold text-graphite sm:text-lg">{label}</p>
        <ImportStatusLabel status={item.status} />
      </div>
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
