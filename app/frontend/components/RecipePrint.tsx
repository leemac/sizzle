import { useEffect, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import Icon from '@/components/Icon'
import PrintLayout from '@/components/PrintLayout'
import { formatAmount, formatDate, formatQuantity, formatTimestamp, groupBySection, sourceLabel } from '@/lib/format'
import { fitToPage } from '@/lib/print'
import { scaleIngredient } from '@/lib/scaleIngredient'
import type { RecipeDetail } from '@/types'

/**
 * A "Print recipe" button, plus the one-page sheet that prints in place of the page.
 * The sheet mounts just before printing — from the button or the browser's own Print —
 * and is fitted to the page then, so it never sits in the page while you're cooking.
 * It prints the servings chosen on the page: the same `stats`, and amounts times `scale`.
 */
export default function RecipePrint({ recipe, stats, scale }: PrintProps) {
  const [printing, setPrinting] = useState(false)
  const sheet = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const before = () => {
      flushSync(() => setPrinting(true))
      if (sheet.current) fitToPage(sheet.current)
    }
    const after = () => setPrinting(false)
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => {
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', after)
    }
  }, [])

  return (
    <>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 rounded-full bg-paper px-4 py-2 ring-1 ring-hairline transition-colors hover:ring-ink/30"
      >
        <Icon name="print" className="size-4" />
        <span>
          Print<span className="sr-only sm:not-sr-only"> recipe</span>
        </span>
      </button>
      {printing && createPortal(<PrintSheet recipe={recipe} stats={stats} scale={scale} ref={sheet} />, document.body)}
    </>
  )
}

type PrintProps = { recipe: RecipeDetail; stats: [string, string][]; scale: number }

const sentenceCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

function PrintSheet({ recipe, stats, scale, ref }: PrintProps & { ref: React.Ref<HTMLDivElement> }) {
  const kicker = [recipe.cuisine, recipe.course]
    .filter((value): value is string => Boolean(value))
    .map(sentenceCase)
    .join(' · ')
  const source = sourceLabel(recipe.source_name, recipe.source_host)
  const labels = [...recipe.diets, ...recipe.tags].map(sentenceCase).join(' · ')
  // The sheet mounts afresh for each print, so this is when this copy was printed.
  const [printedAt] = useState(() => new Date().toISOString())
  const made = recipe.cooks_count === 1 ? 'Made once' : `Made ${recipe.cooks_count} times`
  const history = [
    `Added ${formatDate(recipe.created_at)}`,
    recipe.cooks_count > 0 && made,
    recipe.last_cook && `last made ${formatDate(recipe.last_cook.cooked_at)}`,
  ]
    .filter(Boolean)
    .join(' · ')
  const indexedIngredients = recipe.ingredients.map((ingredient, index) => ({
    ...scaleIngredient(ingredient, scale),
    index,
  }))
  const indexedSteps = recipe.steps.map((step, index) => ({ ...step, index }))
  const hasAmounts = recipe.ingredients.some((ingredient) => Boolean(formatAmount(ingredient)))

  return (
    <PrintLayout
      ref={ref}
      testId="print-sheet"
      source={source}
      footer={
        <>
          {(labels || recipe.source_url) && (
            <div className="print-sheet__row">
              <span>{labels}</span>
              {recipe.source_url && (
                <span className="print-sheet__clip">{recipe.source_url.replace(/^https?:\/\/(www\.)?/, '')}</span>
              )}
            </div>
          )}
          <div className="print-sheet__row">
            <span>{history}</span>
            <span className="print-sheet__printed">Printed {formatTimestamp(printedAt)}</span>
          </div>
        </>
      }
    >
      <section className={`print-sheet__hero ${recipe.hero_url ? 'print-sheet__hero--photo' : ''}`}>
        <div className="print-sheet__intro">
          {kicker && <p className="print-sheet__kicker">{kicker}</p>}
          <h1 className="print-sheet__title">{recipe.title}</h1>
          {recipe.description && <p className="print-sheet__description">{recipe.description}</p>}
          {recipe.author && <p className="print-sheet__byline">By {recipe.author}</p>}
          {stats.length > 0 && (
            <dl className="print-sheet__stats">
              {stats.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        {recipe.hero_url && <img src={recipe.hero_url} alt="" className="print-sheet__photo" />}
      </section>

      <div className="print-sheet__body">
        <section className="print-sheet__shopping">
          <h2 className="print-sheet__heading">Ingredients</h2>
          {scale !== 1 ? (
            <p className="print-sheet__yield">
              {recipe.servings
                ? `Scaled from the original ${recipe.servings} servings`
                : `Quantities scaled ×${formatQuantity(scale)}`}
            </p>
          ) : (
            recipe.servings && recipe.yield_text && <p className="print-sheet__yield">{recipe.yield_text}</p>
          )}
          <div className="print-sheet__groups print-sheet__groups--ingredients">
            {groupBySection(indexedIngredients).map(([section, items]) => (
              <div key={section ?? ''}>
                {section && <h3 className="print-sheet__section">{section}</h3>}
                <ul className={`print-sheet__ingredients ${hasAmounts ? 'print-sheet__ingredients--amounts' : ''}`}>
                  {items.map((ingredient) => (
                    <li key={ingredient.index}>
                      <span className="print-sheet__box" />
                      {hasAmounts && <span className="print-sheet__amount">{formatAmount(ingredient)}</span>}
                      <span>
                        {ingredient.item}
                        {ingredient.preparation && (
                          <span className="print-sheet__muted">, {ingredient.preparation}</span>
                        )}
                        {ingredient.note && <span className="print-sheet__note">{ingredient.note}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {recipe.tips.length > 0 && (
          <div className="print-sheet__aside">
            <h2 className="print-sheet__subheading">Good to know</h2>
            <ul className="print-sheet__tips">
              {recipe.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
        )}

        <section className="print-sheet__method">
          <h2 className="print-sheet__heading">Method</h2>
          <div className="print-sheet__groups print-sheet__groups--steps">
            {groupBySection(indexedSteps).map(([section, steps]) => (
              <div key={section ?? ''}>
                {section && <h3 className="print-sheet__section">{section}</h3>}
                <ol className="print-sheet__steps">
                  {steps.map((step) => (
                    <li key={step.index}>
                      <span className="print-sheet__number">{step.index + 1}</span>
                      <span>{step.text}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>

          {recipe.notes && (
            <div className="print-sheet__notes">
              <h2 className="print-sheet__subheading">Your notes</h2>
              <p>{recipe.notes}</p>
            </div>
          )}
        </section>
      </div>
    </PrintLayout>
  )
}
