// Temporary design lab for gallery cards (development only). Each design is a
// self-contained component so the winner can move into RecipeTile as-is.
// Delete this page, CardLabController and its route once a design is picked.
import { Head, Link } from '@inertiajs/react'
import { useMemo, useState, type ComponentType, type ReactNode } from 'react'
import Icon from '@/components/Icon'
import RecipeTile from '@/components/RecipeTile'
import AppLayout from '@/layouts/AppLayout'
import { formatMinutes } from '@/lib/format'
import type { RecipeCard } from '@/types'

type LabCard = RecipeCard & {
  description: string | null
  servings: number | null
  main_ingredient: string | null
  diets: string[]
}

type Design = {
  id: string
  name: string
  note: string
  grid: string
  Card: ComponentType<{ recipe: LabCard }>
}

const STANDARD_GRID = 'grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4'

const DESIGNS: Design[] = [
  {
    id: 'current',
    name: 'A. Current',
    note: 'What ships today. 4:5 photo, title and meta underneath.',
    grid: STANDARD_GRID,
    Card: RecipeTile,
  },
  {
    id: 'overlay',
    name: 'B. Overlay',
    note: 'Title sits on the photo over a soft scrim. Most photo, least chrome.',
    grid: 'grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4',
    Card: OverlayCard,
  },
  {
    id: 'paper',
    name: 'C. Paper card',
    note: 'A contained card: 4:3 photo, title, then time, cuisine and source.',
    grid: 'grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4',
    Card: PaperCard,
  },
  {
    id: 'badges',
    name: 'D. Photo badges',
    note: 'Like A, but time moves onto the photo so the caption is just the title.',
    grid: STANDARD_GRID,
    Card: BadgeCard,
  },
  {
    id: 'editorial',
    name: 'E. Editorial',
    note: 'Square photo, course eyebrow, two lines of description. Reads like a cookbook index.',
    grid: 'grid-cols-1 gap-y-10 min-[480px]:grid-cols-2 min-[480px]:gap-x-5 lg:grid-cols-3 lg:gap-x-8',
    Card: EditorialCard,
  },
  {
    id: 'dense',
    name: 'F. Dense rows',
    note: 'Thumbnail and text side by side. Scans fastest once the collection is big.',
    grid: 'grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3',
    Card: DenseCard,
  },
]

type Props = { recipes: LabCard[] }

export default function CardLab({ recipes }: Props) {
  const [view, setView] = useState<'compare' | 'gallery'>('compare')
  const [designId, setDesignId] = useState(DESIGNS[0].id)
  const [phone, setPhone] = useState(false)
  const [edgeCases, setEdgeCases] = useState(true)

  const sample = useMemo(() => (edgeCases ? [...withEdgeCases(recipes), ...recipes] : recipes), [recipes, edgeCases])
  const shown = view === 'compare' ? DESIGNS : DESIGNS.filter((design) => design.id === designId)

  return (
    <>
      <Head title="Card lab" />
      <div className="mb-6">
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">Card lab</h1>
        <p className="mt-2 text-graphite">
          Temporary page for comparing gallery card designs with your recipes. Only available in development.
        </p>
      </div>

      <div className="sticky top-16 z-10 -mx-4 mb-8 flex flex-wrap items-center gap-2 border-b border-hairline bg-porcelain/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <Segmented
          label="View"
          value={view}
          onChange={setView}
          options={[
            ['compare', 'Compare all'],
            ['gallery', 'One design'],
          ]}
        />
        {view === 'gallery' && (
          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">Design</span>
            <select
              value={designId}
              onChange={(event) => setDesignId(event.target.value)}
              className="rounded-full border-0 bg-paper py-1.5 pr-8 pl-3 text-sm ring-1 ring-hairline focus:ring-ink"
            >
              {DESIGNS.map((design) => (
                <option key={design.id} value={design.id}>
                  {design.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <Segmented
          label="Width"
          value={phone ? 'phone' : 'full'}
          onChange={(value) => setPhone(value === 'phone')}
          options={[
            ['full', 'Full width'],
            ['phone', '390px'],
          ]}
        />
        <label className="ml-auto flex items-center gap-2 text-sm text-graphite">
          <input
            type="checkbox"
            checked={edgeCases}
            onChange={(event) => setEdgeCases(event.target.checked)}
            className="rounded border-hairline text-ink focus:ring-ink"
          />
          Edge cases first
        </label>
      </div>

      <div className="space-y-16">
        {shown.map((design) => (
          <section key={design.id} aria-labelledby={`design-${design.id}`}>
            <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 id={`design-${design.id}`} className="font-display text-2xl font-semibold">
                {design.name}
              </h2>
              <p className="text-sm text-graphite">{design.note}</p>
            </div>
            <Frame phone={phone}>
              <div className={`grid ${phone ? phoneGrid(design.grid) : design.grid}`}>
                {(view === 'compare' ? sample.slice(0, edgeCases ? 8 : 4) : sample).map((recipe, index) => (
                  <design.Card key={`${recipe.id}-${index}`} recipe={recipe} />
                ))}
              </div>
            </Frame>
          </section>
        ))}
      </div>
    </>
  )
}

CardLab.layout = AppLayout

// The phone frame is narrower than the viewport, so responsive breakpoints
// still see a wide screen. Keep only each grid's mobile classes.
function phoneGrid(grid: string) {
  return grid
    .split(' ')
    .filter((name) => !/^(sm|md|lg|xl|min-\[\d+px\]):/.test(name))
    .join(' ')
}

function Frame({ phone, children }: { phone: boolean; children: ReactNode }) {
  if (!phone) return children
  return (
    <div className="mx-auto w-[390px] max-w-full rounded-[2rem] bg-porcelain p-4 ring-1 ring-hairline">{children}</div>
  )
}

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: [T, string][]
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-full bg-paper p-1 ring-1 ring-hairline">
      {options.map(([option, text]) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={`rounded-full px-3 py-1 text-sm ${value === option ? 'bg-ink text-porcelain' : 'text-graphite hover:text-ink'}`}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

// Real recipes bent into the awkward shapes the gallery has to survive.
function withEdgeCases(recipes: LabCard[]): LabCard[] {
  if (recipes.length < 3) return []
  const [first, second, third, fourth = first] = recipes
  return [
    {
      ...first,
      title: 'Slow-braised short ribs with gremolata, crispy shallots and the butteriest mashed potatoes',
      favorite: true,
    },
    { ...second, image_url: null },
    {
      ...third,
      total_minutes: null,
      cuisine: null,
      course: null,
      description: null,
      servings: null,
      source_host: null,
    },
    { ...fourth, title: 'Dal', total_minutes: 1440, source_host: 'a-really-long-food-blog-domain-name.example.com' },
  ]
}

function meta(recipe: LabCard) {
  return [formatMinutes(recipe.total_minutes), recipe.cuisine].filter(Boolean) as string[]
}

function Photo({ recipe, className = '' }: { recipe: LabCard; className?: string }) {
  return recipe.image_url ? (
    <img
      src={recipe.image_url}
      alt=""
      loading="lazy"
      decoding="async"
      className={`size-full object-cover transition-transform duration-500 group-hover:scale-[1.03] ${className}`}
    />
  ) : (
    <div className="flex size-full items-end bg-paper p-4">
      <span className="font-display text-6xl leading-none font-bold text-hairline">{recipe.title.charAt(0)}</span>
    </div>
  )
}

function Favorite({ recipe, className = '' }: { recipe: LabCard; className?: string }) {
  if (!recipe.favorite) return null
  return (
    <span className={`grid size-8 place-items-center rounded-full bg-paper/90 text-yolk shadow-sm ${className}`}>
      <Icon name="heart" filled className="size-4" />
      <span className="sr-only">Favorite</span>
    </span>
  )
}

function Clock({ className = 'size-3.5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  )
}

function OverlayCard({ recipe }: { recipe: LabCard }) {
  const details = meta(recipe)
  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="group relative block aspect-[4/5] overflow-hidden rounded-photo bg-hairline"
    >
      <Photo recipe={recipe} />
      <Favorite recipe={recipe} className="absolute top-2.5 right-2.5" />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-3 pt-16 sm:p-4 sm:pt-20">
        <h3 className="line-clamp-3 font-display text-base leading-tight font-semibold text-balance text-white sm:text-lg">
          {recipe.title}
        </h3>
        {details.length > 0 && <p className="mt-1 text-xs text-white/80 sm:text-sm">{details.join(' · ')}</p>}
      </div>
    </Link>
  )
}

function PaperCard({ recipe }: { recipe: LabCard }) {
  const time = formatMinutes(recipe.total_minutes)
  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="group flex flex-col overflow-hidden rounded-photo bg-paper ring-1 ring-hairline transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-hairline">
        <Photo recipe={recipe} />
        <Favorite recipe={recipe} className="absolute top-2 right-2" />
      </div>
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <h3 className="line-clamp-2 font-display text-base leading-snug font-semibold text-balance sm:text-lg">
          {recipe.title}
        </h3>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-graphite">
          {time && (
            <span className="inline-flex items-center gap-1">
              <Clock />
              {time}
            </span>
          )}
          {recipe.cuisine && <span>{recipe.cuisine}</span>}
        </p>
        {recipe.source_host && (
          <div className="mt-auto pt-3">
            <p className="truncate border-t border-hairline pt-2 text-xs text-graphite">{recipe.source_host}</p>
          </div>
        )}
      </div>
    </Link>
  )
}

function BadgeCard({ recipe }: { recipe: LabCard }) {
  const time = formatMinutes(recipe.total_minutes)
  return (
    <Link href={`/recipes/${recipe.id}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden rounded-photo bg-hairline">
        <Photo recipe={recipe} />
        {time && (
          <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-paper/90 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur-sm">
            <Clock className="size-3" />
            {time}
          </span>
        )}
        <Favorite recipe={recipe} className="absolute top-2.5 right-2.5" />
      </div>
      <h3 className="mt-2.5 line-clamp-2 font-display text-lg leading-snug font-semibold text-balance">
        {recipe.title}
      </h3>
      {recipe.cuisine && <p className="mt-0.5 text-sm text-graphite">{recipe.cuisine}</p>}
    </Link>
  )
}

function EditorialCard({ recipe }: { recipe: LabCard }) {
  const eyebrow = [recipe.course, recipe.cuisine].filter(Boolean).join(' · ')
  const footer = [formatMinutes(recipe.total_minutes), recipe.servings && `Serves ${recipe.servings}`].filter(Boolean)
  return (
    <Link href={`/recipes/${recipe.id}`} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-photo bg-hairline">
        <Photo recipe={recipe} />
        <Favorite recipe={recipe} className="absolute top-3 right-3" />
      </div>
      {eyebrow && <p className="mt-4 text-xs font-medium text-graphite">{capitalize(eyebrow)}</p>}
      <h3 className={`${eyebrow ? 'mt-1' : 'mt-4'} font-display text-xl leading-snug font-semibold text-balance`}>
        {recipe.title}
      </h3>
      {recipe.description && <p className="mt-2 line-clamp-2 text-sm text-graphite">{recipe.description}</p>}
      {footer.length > 0 && (
        <p className="mt-3 flex gap-3 border-t border-hairline pt-3 text-sm">
          {footer.map((item) => (
            <span key={item as string}>{item}</span>
          ))}
        </p>
      )}
    </Link>
  )
}

function DenseCard({ recipe }: { recipe: LabCard }) {
  const details = meta(recipe)
  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="group flex items-center gap-4 rounded-photo bg-paper p-2 pr-4 ring-1 ring-hairline hover:ring-ink/30"
    >
      <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-hairline sm:size-24">
        <Photo recipe={recipe} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 font-display text-base leading-snug font-semibold">{recipe.title}</h3>
        {details.length > 0 && <p className="mt-0.5 text-sm text-graphite">{details.join(' · ')}</p>}
        {recipe.description && (
          <p className="mt-1 hidden truncate text-sm text-graphite sm:block">{recipe.description}</p>
        )}
      </div>
      {recipe.favorite && (
        <span className="shrink-0 text-yolk">
          <Icon name="heart" filled className="size-4" />
          <span className="sr-only">Favorite</span>
        </span>
      )}
    </Link>
  )
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
