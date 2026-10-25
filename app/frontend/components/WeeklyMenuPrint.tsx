import { useEffect, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import Icon from '@/components/Icon'
import PrintLayout from '@/components/PrintLayout'
import { fitToPage } from '@/lib/print'
import type { RecipeCard } from '@/types'

const format = (value: Date) => value.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack']
type Props = {
  days: { recipeId: number; meal?: string; key: string }[][]
  notes: string[]
  recipes: (RecipeCard & { description: string | null })[]
  date: Date
}

export default function WeeklyMenuPrint(props: Props) {
  const [printing, setPrinting] = useState(false)
  const sheet = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const before = () => {
      flushSync(() => setPrinting(true))
      if (sheet.current) fitToPage(sheet.current, [['menu']])
    }
    const after = () => setPrinting(false)
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => {
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', after)
    }
  }, [])
  const byId = new Map(props.recipes.map((recipe) => [recipe.id, recipe]))
  const end = new Date(props.date)
  end.setDate(end.getDate() + 6)
  const range = `${format(props.date)} – ${format(end)}, ${end.getFullYear()}`
  return (
    <>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-full bg-porcelain px-4 py-2 text-sm ring-1 ring-hairline hover:ring-ink/30"
      >
        <Icon name="print" className="size-4" />
        Print menu
      </button>
      {printing &&
        createPortal(
          <PrintLayout ref={sheet} className="weekly-menu-print">
            <div className="weekly-menu-print__intro">
              <p className="print-sheet__kicker">The week ahead</p>
              <h1>This week’s menu</h1>
              <p>{range}</p>
            </div>
            <div className="weekly-menu-print__days">
              {DAYS.map((day, index) => {
                const date = new Date(props.date)
                date.setDate(date.getDate() + index)
                const entries = props.days[index].filter((entry) => byId.has(entry.recipeId))
                return (
                  <section key={day} className="weekly-menu-print__day">
                    <header>
                      <h2>{day}</h2>
                      <span>{format(date)}</span>
                    </header>
                    {MEALS.map((meal) => {
                      const items = entries.filter((entry) => (entry.meal ?? 'Dinner') === meal)
                      if (!items.length) return null
                      return (
                        <div key={meal} className="weekly-menu-print__meal">
                          <h3>{meal}</h3>
                          {items.map((entry) => {
                            const recipe = byId.get(entry.recipeId)!
                            return (
                              <article key={entry.key}>
                                {recipe.image_url && <img src={recipe.image_url} alt="" />}
                                <div>
                                  <h4>{recipe.title}</h4>
                                  {recipe.description && (
                                    <p className="weekly-menu-print__description">{recipe.description}</p>
                                  )}
                                  {recipe.total_minutes && (
                                    <p className="weekly-menu-print__time">{recipe.total_minutes} min</p>
                                  )}
                                </div>
                              </article>
                            )
                          })}
                        </div>
                      )
                    })}
                    {props.notes[index] && <p className="weekly-menu-print__note">{props.notes[index]}</p>}
                    {!entries.length && !props.notes[index] && (
                      <p className="weekly-menu-print__empty">An open evening</p>
                    )}
                  </section>
                )
              })}
            </div>
          </PrintLayout>,
          document.body,
        )}
    </>
  )
}
