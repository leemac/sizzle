import { useEffect, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import Icon from '@/components/Icon'
import { formatAmount, groupBySection, recipeStats } from '@/lib/format'
import { fitToPage } from '@/lib/print'
import type { RecipeDetail } from '@/types'

/**
 * A "Print recipe" button, plus the one-page sheet that prints in place of the page.
 * The sheet mounts just before printing — from the button or the browser's own Print —
 * and is fitted to the page then, so it never sits in the page while you're cooking.
 */
export default function RecipePrint({ recipe }: { recipe: RecipeDetail }) {
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
      {printing && createPortal(<PrintSheet recipe={recipe} ref={sheet} />, document.body)}
    </>
  )
}

const sentenceCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

function PrintSheet({ recipe, ref }: { recipe: RecipeDetail; ref: React.Ref<HTMLDivElement> }) {
  const stats = recipeStats(recipe)
  const kicker = [recipe.cuisine, recipe.course]
    .filter((value): value is string => Boolean(value))
    .map(sentenceCase)
    .join(' · ')
  const source = recipe.source_name || recipe.source_host
  const labels = [...recipe.diets, ...recipe.tags].map(sentenceCase).join(' · ')
  const indexedIngredients = recipe.ingredients.map((ingredient, index) => ({ ...ingredient, index }))
  const indexedSteps = recipe.steps.map((step, index) => ({ ...step, index }))
  const hasAmounts = recipe.ingredients.some((ingredient) => Boolean(formatAmount(ingredient)))

  return (
    <div ref={ref} className="print-sheet" data-testid="print-sheet">
      <header className="print-sheet__masthead">
        <span className="print-sheet__brand">Sizzle</span>
        {source && <span className="print-sheet__clip">{source}</span>}
      </header>

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
          {recipe.servings && recipe.yield_text && <p className="print-sheet__yield">{recipe.yield_text}</p>}
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

      {(labels || recipe.source_url) && (
        <footer className="print-sheet__footer">
          <span>{labels}</span>
          {recipe.source_url && (
            <span className="print-sheet__clip">{recipe.source_url.replace(/^https?:\/\/(www\.)?/, '')}</span>
          )}
        </footer>
      )}
    </div>
  )
}
