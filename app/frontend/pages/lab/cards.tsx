// Temporary design lab for gallery cards (development only). Each card is a
// self-contained component so the winner can move into RecipeTile as-is.
// Delete this page, CardLabController and its route once a design is picked.
import { Head, Link } from '@inertiajs/react'
import { useMemo, useState, type ReactNode } from 'react'
import Icon from '@/components/Icon'
import AppLayout from '@/layouts/AppLayout'
import { formatMinutes } from '@/lib/format'
import { useGalleryLayout, type GalleryLayout } from '@/lib/galleryLayout'
import type { RecipeCard } from '@/types'

type LabCard = RecipeCard & {
  description: string | null
  servings: number | null
  main_ingredient: string | null
  diets: string[]
}

// How the black caption panel sits on the photo.
type Panel = {
  id: string
  name: string
  note: string
  className: string
}

const PANELS: Panel[] = [
  {
    id: 'band',
    name: 'B1. Black band',
    note: 'Full-width black at 85%. Crisp edge, photo barely shows through.',
    className: 'inset-x-0 bottom-0 bg-black/85',
  },
  {
    id: 'band-blur',
    name: 'B2. Lighter band, blurred',
    note: 'Black at 70% with a backdrop blur, so the photo’s colour bleeds in.',
    className: 'inset-x-0 bottom-0 bg-black/70 backdrop-blur-md',
  },
  {
    id: 'floating',
    name: 'B3. Floating panel',
    note: 'Inset and rounded, black at 80%. Reads as a label stuck on the photo.',
    className: 'inset-x-2 bottom-2 rounded-xl bg-black/80 backdrop-blur-sm',
  },
  {
    id: 'feathered',
    name: 'B4. Feathered band',
    note: 'Black at 85% with a short fade above it instead of a hard edge.',
    className:
      'inset-x-0 bottom-0 bg-black/85 before:absolute before:inset-x-0 before:bottom-full before:h-8 before:bg-gradient-to-t before:from-black/85 before:to-transparent',
  },
]

const GRIDS: Record<GalleryLayout, string> = {
  grid: 'grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4',
  list: 'grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3',
}

type Props = { recipes: LabCard[] }

export default function CardLab({ recipes }: Props) {
  const [view, setView] = useState<'preview' | 'compare'>('preview')
  const [panelId, setPanelId] = useState(PANELS[0].id)
  const [phone, setPhone] = useState(false)
  const [edgeCases, setEdgeCases] = useState(true)
  const [layout, setLayout] = useGalleryLayout()

  const sample = useMemo(() => (edgeCases ? [...withEdgeCases(recipes), ...recipes] : recipes), [recipes, edgeCases])
  const panel = PANELS.find((option) => option.id === panelId) ?? PANELS[0]

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
            ['preview', 'Gallery preview'],
            ['compare', 'Compare overlays'],
          ]}
        />
        {view === 'preview' && (
          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">Overlay style</span>
            <select
              value={panelId}
              onChange={(event) => setPanelId(event.target.value)}
              className="rounded-full border-0 bg-paper py-1.5 pr-8 pl-3 text-sm ring-1 ring-hairline focus:ring-ink"
            >
              {PANELS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
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

      {view === 'preview' ? (
        <Frame phone={phone}>
          <div className="mb-5 flex items-center justify-between gap-4">
            <p className="text-sm text-graphite">{sample.length} recipes</p>
            <LayoutToggle value={layout} onChange={setLayout} />
          </div>
          <Gallery layout={layout} panel={panel} recipes={sample} phone={phone} />
        </Frame>
      ) : (
        <div className="space-y-16">
          {PANELS.map((option) => (
            <Section key={option.id} id={option.id} title={option.name} note={option.note}>
              <Frame phone={phone}>
                <Gallery layout="grid" panel={option} recipes={sample.slice(0, 8)} phone={phone} />
              </Frame>
            </Section>
          ))}
          <Section id="list" title="Dense rows" note="The list layout people can switch to.">
            <Frame phone={phone}>
              <Gallery layout="list" panel={panel} recipes={sample.slice(0, 8)} phone={phone} />
            </Frame>
          </Section>
        </div>
      )}
    </>
  )
}

CardLab.layout = AppLayout

function Gallery({
  layout,
  panel,
  recipes,
  phone,
}: {
  layout: GalleryLayout
  panel: Panel
  recipes: LabCard[]
  phone: boolean
}) {
  return (
    <div className={`grid ${phone ? phoneGrid(GRIDS[layout]) : GRIDS[layout]}`}>
      {recipes.map((recipe, index) =>
        layout === 'grid' ? (
          <OverlayCard key={`${recipe.id}-${index}`} recipe={recipe} panel={panel} />
        ) : (
          <DenseCard key={`${recipe.id}-${index}`} recipe={recipe} />
        ),
      )}
    </div>
  )
}

function Section({ id, title, note, children }: { id: string; title: string; note: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`design-${id}`}>
      <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id={`design-${id}`} className="font-display text-2xl font-semibold">
          {title}
        </h2>
        <p className="text-sm text-graphite">{note}</p>
      </div>
      {children}
    </section>
  )
}

// The phone frame is narrower than the viewport, so responsive breakpoints
// still see a wide screen. Keep only each grid's mobile classes.
function phoneGrid(grid: string) {
  return grid
    .split(' ')
    .filter((name) => !/^(sm|md|lg|xl):/.test(name))
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

// The control that would ship in the gallery header.
function LayoutToggle({ value, onChange }: { value: GalleryLayout; onChange: (layout: GalleryLayout) => void }) {
  const options: [GalleryLayout, string, string][] = [
    ['grid', 'Show as grid', 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z'],
    ['list', 'Show as list', 'M4 5h4v4H4zM4 15h4v4H4zM11 7h9M11 17h9'],
  ]
  return (
    <div role="group" aria-label="Layout" className="flex rounded-full bg-paper p-1 ring-1 ring-hairline">
      {options.map(([option, label, path]) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          aria-label={label}
          title={label}
          onClick={() => onChange(option)}
          className={`grid size-8 place-items-center rounded-full ${value === option ? 'bg-ink text-porcelain' : 'text-graphite hover:text-ink'}`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinejoin="round"
            strokeLinecap="round"
            className="size-4"
            aria-hidden="true"
          >
            <path d={path} />
          </svg>
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
    { ...fourth, title: 'Dal', total_minutes: 1440, favorite: true },
  ]
}

function Photo({ recipe }: { recipe: LabCard }) {
  return recipe.image_url ? (
    <img
      src={recipe.image_url}
      alt=""
      loading="lazy"
      decoding="async"
      className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
    />
  ) : (
    <div className="flex size-full items-start bg-paper p-4">
      <span className="font-display text-6xl leading-none font-bold text-hairline">{recipe.title.charAt(0)}</span>
    </div>
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

const PILL = 'absolute top-2.5 inline-flex h-7 items-center rounded-full bg-black/70 text-white backdrop-blur-sm'

function OverlayCard({ recipe, panel }: { recipe: LabCard; panel: Panel }) {
  const time = formatMinutes(recipe.total_minutes)
  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="group relative block aspect-[4/5] overflow-hidden rounded-photo bg-hairline"
    >
      <Photo recipe={recipe} />
      {recipe.favorite && (
        <span className={`${PILL} left-2.5 w-7 justify-center text-yolk`}>
          <Icon name="heart" filled className="size-3.5" />
          <span className="sr-only">Favorite</span>
        </span>
      )}
      {time && (
        <span className={`${PILL} right-2.5 gap-1 px-2.5 text-xs font-medium`}>
          <Clock className="size-3" />
          {time}
        </span>
      )}
      <div className={`absolute px-3 py-2.5 sm:px-4 sm:py-3 ${panel.className}`}>
        <h3 className="relative line-clamp-2 font-display text-base leading-tight font-semibold text-balance text-white sm:text-lg">
          {recipe.title}
        </h3>
        {recipe.cuisine && <p className="relative mt-0.5 text-xs text-white/70 sm:text-sm">{recipe.cuisine}</p>}
      </div>
    </Link>
  )
}

function DenseCard({ recipe }: { recipe: LabCard }) {
  const time = formatMinutes(recipe.total_minutes)
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
        {recipe.cuisine && <p className="mt-0.5 text-sm text-graphite">{recipe.cuisine}</p>}
        {recipe.description && (
          <p className="mt-1 hidden truncate text-sm text-graphite sm:block">{recipe.description}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5 self-start pt-1 text-xs text-graphite">
        {time && (
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <Clock className="size-3" />
            {time}
          </span>
        )}
        {recipe.favorite && (
          <span className="text-yolk">
            <Icon name="heart" filled className="size-4" />
            <span className="sr-only">Favorite</span>
          </span>
        )}
      </div>
    </Link>
  )
}
