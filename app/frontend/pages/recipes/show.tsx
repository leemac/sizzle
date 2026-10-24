import { Head, Link, router } from '@inertiajs/react'
import { useState } from 'react'
import Icon from '@/components/Icon'
import AppLayout from '@/layouts/AppLayout'
import { formatAmount, formatMinutes, groupBySection } from '@/lib/format'
import type { RecipeDetail } from '@/types'

export default function RecipeShow({ recipe }: { recipe: RecipeDetail }) {
  const stats = [
    ['Prep', formatMinutes(recipe.prep_minutes)],
    ['Cook', formatMinutes(recipe.cook_minutes)],
    ['Total', formatMinutes(recipe.total_minutes)],
    ['Serves', recipe.servings ? String(recipe.servings) : recipe.yield_text],
  ].filter((stat): stat is [string, string] => Boolean(stat[1]))

  const source = recipe.source_name || recipe.source_host

  return (
    <article>
      <Head title={recipe.title} />
      <div className="mb-6 flex items-center justify-between gap-4 text-sm">
        <Link href="/" className="inline-flex items-center gap-1 text-graphite hover:text-ink">
          <Icon name="back" className="size-4" />
          All recipes
        </Link>
        <Link
          href={`/recipes/${recipe.id}/edit`}
          className="inline-flex items-center gap-1.5 text-graphite hover:text-ink"
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

      <header className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end">
        {recipe.hero_url && (
          <img
            src={recipe.hero_url}
            alt={recipe.title}
            className="aspect-[4/3] w-full rounded-photo object-cover lg:order-2 lg:aspect-[4/5]"
          />
        )}
        <div className="lg:order-1 lg:pb-4">
          <h1 className="font-display text-4xl leading-[0.95] font-semibold text-balance sm:text-6xl">
            {recipe.title}
          </h1>
          <FavoriteButton recipe={recipe} />
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

          <div className="mt-8 flex flex-wrap items-center gap-2">
            {[...recipe.diets, ...recipe.tags].map((tag) => (
              <span key={tag} className="rounded-full px-3 py-1 text-sm ring-1 ring-hairline">
                {tag}
              </span>
            ))}
          </div>

          {recipe.source_url && (
            <p className="mt-6 text-sm text-graphite">
              {recipe.author ? `By ${recipe.author}, from ` : 'From '}
              <a
                href={recipe.source_url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1 text-ink underline decoration-hairline underline-offset-4 hover:decoration-ink"
              >
                {source}
                <Icon name="external" className="size-3.5" />
              </a>
            </p>
          )}
        </div>
      </header>

      <div className="mt-14 grid gap-14 border-t border-hairline pt-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Ingredients recipe={recipe} />
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

function Ingredients({ recipe }: { recipe: RecipeDetail }) {
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const indexed = recipe.ingredients.map((ingredient, index) => ({ ...ingredient, index }))
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
      {recipe.yield_text && <p className="mt-1 text-sm text-graphite">{recipe.yield_text}</p>}

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
                    active === step.index ? 'bg-yolk-soft' : 'hover:bg-paper'
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
          <ul className="mt-3 list-disc space-y-2 pl-5 text-graphite marker:text-yolk">
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
      className={`mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors disabled:opacity-60 ${
        recipe.favorite ? 'bg-yolk font-medium text-[#18181b]' : 'bg-paper ring-1 ring-hairline hover:ring-ink/30'
      }`}
    >
      <Icon name="heart" filled={recipe.favorite} className="size-4" />
      {recipe.favorite ? 'Favorited' : 'Add to favorites'}
    </button>
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
            className="rounded-full bg-danger px-4 py-1.5 font-medium text-white"
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
