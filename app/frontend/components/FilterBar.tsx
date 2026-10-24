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
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const timer = setTimeout(() => visit({ ...filters, q: query }), 250)
    return () => clearTimeout(timer)
    // Only re-run when the search text changes; other filters apply immediately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const set = (key: keyof RecipeFilters, value: string | undefined) =>
    visit({ ...filters, q: query, [key]: filters[key] === value ? undefined : value })

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
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by dish, ingredient or tag"
          className="w-full rounded-full border-hairline bg-paper py-3 pr-4 pl-12 text-base placeholder:text-graphite focus:border-ink focus:ring-0"
        />
      </label>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
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
        selected ? 'bg-yolk font-medium text-[#18181b]' : 'bg-paper text-ink ring-1 ring-hairline hover:ring-ink/30'
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
          value ? 'bg-yolk font-medium text-[#18181b] ring-yolk' : 'bg-paper ring-hairline'
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
