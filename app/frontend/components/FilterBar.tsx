import { router } from '@inertiajs/react'
import { useEffect, useRef, useState } from 'react'
import Icon from '@/components/Icon'
import { formatMinutes } from '@/lib/format'
import type { FacetCount, Facets, RecipeFilters } from '@/types'

function visit(filters: RecipeFilters) {
  const query = Object.fromEntries(Object.entries(filters).filter(([, value]) => value))
  router.get('/', query, { preserveState: true, preserveScroll: true, replace: true })
}

export default function FilterBar({ filters, facets }: { filters: RecipeFilters; facets: Facets }) {
  const [query, setQuery] = useState(filters.q ?? '')
  const [previousQuery, setPreviousQuery] = useState(filters.q)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  if (filters.q !== previousQuery) {
    setPreviousQuery(filters.q)
    setQuery(filters.q ?? '')
  }

  const cancelSearch = () => clearTimeout(timer.current)
  useEffect(() => () => clearTimeout(timer.current), [timer])
  useEffect(() => {
    if (query === (filters.q ?? '')) clearTimeout(timer.current)
  }, [filters.q, query, timer])

  const search = (value: string) => {
    setQuery(value)
    cancelSearch()
    timer.current = setTimeout(() => visit({ ...filters, q: value }), 250)
  }

  const set = (key: keyof RecipeFilters, value: string | undefined) => {
    cancelSearch()
    visit({ ...filters, q: query, [key]: filters[key] === value ? undefined : value })
  }

  const active = Object.entries(filters).some(([, value]) => value)

  return (
    <div className="space-y-3">
      <label className="relative block">
        <span className="sr-only">Search recipes</span>
        <Icon
          name="search"
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-graphite"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => search(event.target.value)}
          placeholder="Search by dish, ingredient or tag"
          className="w-full rounded-full border-hairline bg-paper py-3 pr-4 pl-12 text-base placeholder:text-graphite focus:border-ink focus:ring-0"
        />
      </label>

      <div className="relative -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        {(facets.favorites > 0 || filters.favorites) && (
          <Chip selected={Boolean(filters.favorites)} onClick={() => set('favorites', '1')}>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="heart" filled={Boolean(filters.favorites)} className="size-4" />
              Favorites
            </span>
          </Chip>
        )}
        {facets.courses.map(({ value }) => (
          <Chip key={value} selected={filters.course === value} onClick={() => set('course', value)}>
            {value}
          </Chip>
        ))}
        {facets.max_minutes.map((minutes) => (
          <Chip
            key={minutes}
            selected={filters.max_minutes === String(minutes)}
            onClick={() => set('max_minutes', String(minutes))}
          >
            Under {formatMinutes(minutes)}
          </Chip>
        ))}
        <FacetSelect
          label="Cuisine"
          value={filters.cuisine}
          options={facets.cuisines}
          onChange={(v) => set('cuisine', v)}
        />
        <FacetSelect label="Diet" value={filters.diet} options={facets.diets} onChange={(v) => set('diet', v)} />
        <FacetSelect
          label="Main ingredient"
          value={filters.main}
          options={facets.main_ingredients}
          onChange={(v) => set('main', v)}
        />
        {active && (
          <button
            type="button"
            onClick={() => {
              cancelSearch()
              setQuery('')
              visit({})
            }}
            className="shrink-0 px-3 py-1.5 text-sm text-graphite underline-offset-4 hover:text-ink hover:underline"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-colors first-letter:uppercase ${
        selected ? 'bg-active font-medium text-on-active' : 'bg-paper text-ink ring-1 ring-hairline hover:ring-ink/30'
      }`}
    >
      {children}
    </button>
  )
}

function FacetSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value?: string
  options: FacetCount[]
  onChange: (value: string | undefined) => void
}) {
  if (options.length === 0) return null

  return (
    <label className="shrink-0">
      <span className="sr-only">{label}</span>
      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || undefined)}
        className={`rounded-full border-0 py-1.5 pr-8 pl-3.5 text-sm ring-1 focus:ring-ink ${
          value ? 'bg-active font-medium text-on-active ring-active' : 'bg-paper ring-hairline'
        }`}
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.value} ({option.count})
          </option>
        ))}
      </select>
    </label>
  )
}
