import { Link, router } from '@inertiajs/react'
import { useState } from 'react'
import Icon from '@/components/Icon'
import RecipeVideo from '@/components/RecipeVideo'
import AppLayout from '@/layouts/AppLayout'
import { formatAmount, formatDay, formatMinutes, formatTimestamp, groupBySection, isToday, timeAgo } from '@/lib/format'
import type { RecipeDetail } from '@/types'
import { scaleIngredient } from '@/lib/scaleIngredient'

export default function RecipeShow({ recipe }: { recipe: RecipeDetail }) {
  const [servingChoice, setServingChoice] = useState<{
    recipeId: number
    base: number | null
    value: string
    multiplier: number
  } | null>(null)
  const choice = servingChoice?.recipeId === recipe.id && servingChoice.base === recipe.servings ? servingChoice : null
  const servings = choice?.value ?? String(recipe.servings ?? '')
  const targetServings = Number(servings)
  const validServings = Number.isInteger(targetServings * 2) && targetServings >= 0.5 && targetServings <= 10000
  const scale = recipe.servings ? (validServings ? targetServings / recipe.servings : 1) : (choice?.multiplier ?? 1)
  const changeServings = (value: string) =>
    setServingChoice({ recipeId: recipe.id, base: recipe.servings, value, multiplier: 1 })
  const multiply = (multiplier: number) =>
    setServingChoice({
      recipeId: recipe.id,
      base: recipe.servings,
      value: recipe.servings ? String(recipe.servings * multiplier) : '',
      multiplier,
    })
  const stats = [
    ['Prep', formatMinutes(recipe.prep_minutes)],
    ['Cook', formatMinutes(recipe.cook_minutes)],
    ['Total', formatMinutes(recipe.total_minutes)],
    [
      scale !== 1 && !recipe.servings ? 'Original yield' : 'Serves',
      recipe.servings ? String(validServings ? targetServings : recipe.servings) : recipe.yield_text,
    ],
  ].filter((stat): stat is [string, string] => Boolean(stat[1]))

  return (
    <article>
      <div className="mb-6 flex items-center justify-between gap-4 text-sm">
        <Link href="/" className="inline-flex items-center gap-1 text-graphite hover:text-ink">
          <Icon name="back" className="size-4" />
          All recipes
        </Link>
        <Link
          href={`/recipes/${recipe.id}/edit`}
          className="inline-flex items-center gap-1.5 rounded-full bg-paper px-4 py-2 ring-1 ring-hairline transition-colors hover:ring-ink/30"
        >
          <Icon name="edit" className="size-4" />
          Edit recipe
        </Link>
      </div>

      {recipe.archived && (
        <p role="status" className="mb-6 rounded-2xl bg-paper px-4 py-3 text-sm ring-1 ring-hairline">
          This recipe is archived. It's hidden from your recipes and search.
        </p>
      )}

      <header className="relative isolate grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-y-5">
        {recipe.hero_url && <RecipeAtmosphere key={recipe.hero_url} url={recipe.image_url ?? recipe.hero_url} />}
        {recipe.hero_url && (
          <img
            src={recipe.hero_url}
            alt={recipe.title}
            fetchPriority="high"
            className="aspect-[4/3] w-full rounded-photo object-cover lg:col-start-2 lg:row-start-1 lg:aspect-[4/5]"
          />
        )}
        <div className="lg:col-start-1 lg:row-start-1 lg:self-end lg:pb-4">
          <h1 className="font-display text-4xl leading-[0.95] font-semibold text-balance sm:text-6xl">
            {recipe.title}
          </h1>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <FavoriteButton recipe={recipe} />
            <MadeButton recipe={recipe} />
          </div>
          {recipe.description && <p className="mt-5 max-w-prose text-lg text-graphite">{recipe.description}</p>}

          {stats.length > 0 && (
            <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
              {stats.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-sm text-graphite">{label}</dt>
                  <dd className="font-display text-2xl font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          {recipe.diets.length + recipe.tags.length > 0 && (
            <div className="mt-8 flex flex-wrap items-center gap-2">
              {[...recipe.diets, ...recipe.tags].map((tag) => (
                <span key={tag} className="rounded-full px-3 py-1 text-sm ring-1 ring-hairline">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <RecipeMeta
          recipe={recipe}
          className={`lg:col-start-2 ${recipe.hero_url ? 'lg:row-start-2' : 'lg:row-start-1 lg:self-end'}`}
        />
      </header>

      <div className="mt-14 grid gap-14 border-t border-hairline pt-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Ingredients key={recipe.id} recipe={recipe} scale={scale}>
          <div role="group" aria-label="Ingredient quantities" className="mt-4 flex flex-wrap gap-2">
            {(
              [
                [0.5, '½×', 'Half quantities'],
                [1, '1×', 'Original quantities'],
                [2, '2×', 'Double quantities'],
              ] as const
            ).map(([multiplier, label, name]) => (
              <button
                key={multiplier}
                type="button"
                aria-label={name}
                aria-pressed={scale === multiplier}
                disabled={!!recipe.servings && recipe.servings * multiplier > 10000}
                onClick={() => multiply(multiplier)}
                className={`min-h-11 min-w-14 rounded-full px-4 py-2 text-sm tabular-nums disabled:opacity-50 ${scale === multiplier ? 'bg-active font-medium text-on-active' : 'bg-paper ring-1 ring-hairline hover:ring-ink/30'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {recipe.servings ? (
            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor="recipe-servings" className="text-sm font-medium">
                  Servings
                </label>
                <input
                  id="recipe-servings"
                  type="number"
                  min={0.5}
                  max={10000}
                  step={0.5}
                  value={servings}
                  onChange={(event) => changeServings(event.target.value)}
                  className="w-24 rounded-xl border-hairline bg-paper px-3 py-2 text-base focus:border-ink focus:ring-0"
                  aria-invalid={!validServings}
                  aria-describedby="servings-hint"
                />
                {servings !== String(recipe.servings) && (
                  <button
                    type="button"
                    onClick={() => changeServings(String(recipe.servings))}
                    className="rounded-full px-3 py-2 text-sm ring-1 ring-hairline hover:bg-paper"
                  >
                    Reset
                  </button>
                )}
              </div>
              <p id="servings-hint" className="mt-2 text-sm text-graphite">
                {validServings
                  ? `Original recipe serves ${recipe.servings}. Quantities adjust for this view.`
                  : 'Enter servings from ½ to 10,000, in half-serving increments.'}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-graphite">Add servings in Edit recipe to choose a serving count.</p>
          )}
          {scale !== 1 && (
            <p role="status" className="mt-2 text-sm text-graphite">
              Only ingredient quantities adjust. Amounts without a number stay unchanged.
            </p>
          )}
        </Ingredients>
        <Steps recipe={recipe} />
      </div>

      {recipe.photo_urls.length > 0 && (
        <section className="mt-16">
          <h2 className="font-display text-2xl font-semibold">Along the way</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {recipe.photo_urls.map((url) => (
              <img
                key={url}
                src={url}
                alt=""
                loading="lazy"
                className="aspect-square w-full rounded-photo object-cover"
              />
            ))}
          </div>
        </section>
      )}

      <RecipeActions recipe={recipe} />
    </article>
  )
}

RecipeShow.layout = AppLayout

function RecipeAtmosphere({ url }: { url: string }) {
  const [ready, setReady] = useState(false)
  return (
    <div className="recipe-atmosphere" data-ready={ready} aria-hidden="true">
      <img
        src={url}
        alt=""
        decoding="async"
        fetchPriority="low"
        onLoad={() => setReady(true)}
        onError={() => setReady(false)}
      />
    </div>
  )
}

function Ingredients({ recipe, scale, children }: { recipe: RecipeDetail; scale: number; children: React.ReactNode }) {
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const indexed = recipe.ingredients.map((ingredient, index) => ({ ...scaleIngredient(ingredient, scale), index }))
  const hasAmounts = recipe.ingredients.some((ingredient) => Boolean(formatAmount(ingredient)))

  const toggle = (index: number) =>
    setChecked((previous) => {
      const next = new Set(previous)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })

  return (
    <section className="lg:sticky lg:top-24 lg:self-start">
      <h2 className="font-display text-2xl font-semibold">Ingredients</h2>
      {recipe.yield_text && scale === 1 && <p className="mt-1 text-sm text-graphite">{recipe.yield_text}</p>}
      {children}

      {groupBySection(indexed).map(([section, items]) => (
        <div key={section ?? ''} className="mt-6">
          {section && <h3 className="mb-2 font-medium">{section}</h3>}
          <ul className="divide-y divide-hairline">
            {items.map((ingredient) => {
              const done = checked.has(ingredient.index)
              const amount = formatAmount(ingredient)
              return (
                <li key={ingredient.index}>
                  <button
                    type="button"
                    aria-pressed={done}
                    onClick={() => toggle(ingredient.index)}
                    className={`flex w-full gap-3 py-3 text-left transition-colors ${done ? 'text-graphite' : ''}`}
                  >
                    {hasAmounts && <span className="w-20 shrink-0 font-medium tabular-nums">{amount}</span>}
                    <span className={done ? 'highlight' : ''}>
                      {ingredient.item}
                      {ingredient.preparation && <span className="text-graphite">, {ingredient.preparation}</span>}
                      {ingredient.note && <span className="block text-sm text-graphite">{ingredient.note}</span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </section>
  )
}

function Steps({ recipe }: { recipe: RecipeDetail }) {
  const [active, setActive] = useState<number | null>(null)
  const indexed = recipe.steps.map((step, index) => ({ ...step, index }))

  return (
    <section>
      <RecipeVideo recipe={recipe} />
      <h2 className="font-display text-2xl font-semibold">Method</h2>
      {groupBySection(indexed).map(([section, steps]) => (
        <div key={section ?? ''} className="mt-6">
          {section && <h3 className="mb-2 font-medium">{section}</h3>}
          <ol className="space-y-2">
            {steps.map((step) => (
              <li key={step.index}>
                <button
                  type="button"
                  onClick={() => setActive(active === step.index ? null : step.index)}
                  aria-current={active === step.index ? 'step' : undefined}
                  className={`grid w-full grid-cols-[2.5rem_1fr] gap-2 rounded-2xl p-3 -mx-3 text-left transition-colors ${
                    active === step.index ? 'bg-mark' : 'hover:bg-paper'
                  }`}
                >
                  <span className="font-display text-2xl leading-7 font-semibold text-graphite tabular-nums">
                    {step.index + 1}
                  </span>
                  <span className="max-w-prose text-lg leading-relaxed">{step.text}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      ))}

      {recipe.tips.length > 0 && (
        <div className="mt-12 rounded-photo bg-paper p-6 ring-1 ring-hairline">
          <h2 className="font-display text-xl font-semibold">Good to know</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-graphite marker:text-accent">
            {recipe.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      )}

      {recipe.notes && (
        <div className="mt-12">
          <h2 className="font-display text-xl font-semibold">Your notes</h2>
          <p className="mt-3 max-w-prose whitespace-pre-line text-graphite">{recipe.notes}</p>
        </div>
      )}
    </section>
  )
}

function FavoriteButton({ recipe }: { recipe: RecipeDetail }) {
  const [processing, setProcessing] = useState(false)
  const url = `/recipes/${recipe.id}/favorite`
  const options = {
    preserveScroll: true,
    onStart: () => setProcessing(true),
    onFinish: () => setProcessing(false),
  }

  return (
    <button
      type="button"
      aria-pressed={recipe.favorite}
      disabled={processing}
      onClick={() => (recipe.favorite ? router.delete(url, options) : router.post(url, {}, options))}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors disabled:opacity-60 ${
        recipe.favorite ? 'bg-active font-medium text-on-active' : 'bg-paper ring-1 ring-hairline hover:ring-ink/30'
      }`}
    >
      <Icon name="heart" filled={recipe.favorite} className="size-4" />
      {recipe.favorite ? 'Favorited' : 'Add to favorites'}
    </button>
  )
}

function MadeButton({ recipe }: { recipe: RecipeDetail }) {
  const [processing, setProcessing] = useState(false)
  const options = {
    preserveScroll: true,
    onStart: () => setProcessing(true),
    onFinish: () => setProcessing(false),
  }
  const lastCook = recipe.last_cook
  const madeToday = lastCook && isToday(lastCook.cooked_at)

  if (madeToday) {
    return (
      <span className="inline-flex items-center">
        <span
          role="status"
          className="inline-flex items-center gap-2 rounded-full bg-active px-4 py-2 text-sm font-medium text-on-active"
        >
          <Icon name="check" className="size-4" />
          Made today
        </span>
        <button
          type="button"
          disabled={processing}
          onClick={() => router.delete(`/recipes/${recipe.id}/cooks/${lastCook.id}`, options)}
          className="px-3 py-2 text-sm text-graphite hover:text-ink disabled:opacity-60"
        >
          Undo
        </button>
      </span>
    )
  }

  return (
    <button
      type="button"
      disabled={processing}
      onClick={() => router.post(`/recipes/${recipe.id}/cooks`, {}, options)}
      className="inline-flex items-center gap-2 rounded-full bg-paper px-4 py-2 text-sm ring-1 ring-hairline transition-colors hover:ring-ink/30 disabled:opacity-60"
    >
      <Icon name="check" className="size-4" />I made this
    </button>
  )
}

/** Where the recipe came from and its history, under the photo. */
function RecipeMeta({ recipe, className }: { recipe: RecipeDetail; className: string }) {
  const source = recipe.source_name || recipe.source_host
  const count = recipe.cooks_count
  const stats: [string, string | null, (string | null)?][] = [
    ['Made', count === 0 ? 'Not yet' : count === 1 ? 'Once' : `${count} times`],
    ['Last made', recipe.last_cook && formatDay(recipe.last_cook.cooked_at)],
    ['Added', timeAgo(recipe.created_at), formatTimestamp(recipe.created_at)],
    ['Updated', recipe.edited_at && timeAgo(recipe.edited_at), recipe.edited_at && formatTimestamp(recipe.edited_at)],
  ]

  return (
    <aside aria-label="Recipe details" className={className}>
      {(recipe.source_url || recipe.author) && (
        <p className="mb-4 text-sm text-graphite">
          {recipe.author && `By ${recipe.author}`}
          {recipe.source_url && (
            <>
              {recipe.author ? ', from ' : 'From '}
              <a
                href={recipe.source_url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1 text-ink underline decoration-hairline underline-offset-4 hover:decoration-ink"
              >
                {source}
                <Icon name="external" className="size-3.5" />
              </a>
            </>
          )}
        </p>
      )}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-2xl bg-paper p-4 text-sm ring-1 ring-hairline sm:grid-cols-4 lg:grid-cols-2">
        {stats.map(
          ([label, value, exact]) =>
            value && (
              <div key={label}>
                <dt className="text-graphite">{label}</dt>
                <dd title={exact ?? undefined} className="mt-0.5 font-medium tabular-nums">
                  {value}
                </dd>
              </div>
            ),
        )}
      </dl>
    </aside>
  )
}

function RecipeActions({ recipe }: { recipe: RecipeDetail }) {
  const [confirming, setConfirming] = useState(false)

  return (
    <footer className="mt-20 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-hairline pt-6 text-sm">
      {confirming ? (
        <>
          <span>Delete “{recipe.title}” for good?</span>
          <button
            type="button"
            onClick={() => router.delete(`/recipes/${recipe.id}`)}
            className="rounded-full bg-danger px-4 py-1.5 font-medium text-on-danger"
          >
            Delete recipe
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="px-2 py-1.5 text-graphite">
            Keep it
          </button>
        </>
      ) : (
        <>
          <Link href={`/recipes/${recipe.id}/edit`} className="text-graphite hover:text-ink">
            Edit recipe
          </Link>
          {!recipe.archived && (
            <button
              type="button"
              onClick={() => router.post(`/recipes/${recipe.id}/archive`)}
              className="text-graphite hover:text-ink"
            >
              Archive recipe
            </button>
          )}
          <button type="button" onClick={() => setConfirming(true)} className="text-graphite hover:text-danger">
            Delete recipe
          </button>
        </>
      )}
    </footer>
  )
}
