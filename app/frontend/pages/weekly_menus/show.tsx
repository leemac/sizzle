/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
import { Link } from '@inertiajs/react'
import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import AppLayout from '@/layouts/AppLayout'
import WeeklyMenuPrint from '@/components/WeeklyMenuPrint'
import Icon from '@/components/Icon'
import type { MenuRecipe, RecipeCard } from '@/types'
import { sameRecipe, uniqueMealEntries } from '@/lib/menuDuplicates'

const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const
type Meal = (typeof MEALS)[number]
type Entry = { key: string; recipeId: number; meal?: Meal }
type Week = { days: Entry[][]; notes: string[] }
const format = (value: Date) => value.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const empty = (): Week => ({ days: DAYS.map(() => []), notes: DAYS.map(() => '') })
function sunday(offset: number) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - date.getDay() + offset * 7)
  return date
}
function weekKey(date: Date) {
  return `sizzle:menu:${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}
function read(key: string): Week {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (
      value?.days?.length === 7 &&
      value?.notes?.length === 7 &&
      value.days.every(
        (day: unknown) =>
          Array.isArray(day) &&
          day.every(
            (item: Entry) =>
              item &&
              typeof item.key === 'string' &&
              Number.isSafeInteger(item.recipeId) &&
              (item.meal === undefined || MEALS.includes(item.meal)),
          ),
      ) &&
      value.notes.every((note: unknown) => typeof note === 'string')
    )
      return value
  } catch {
    /* Storage may be unavailable. */
  }
  return empty()
}

function savedMenus() {
  const menus: { key: string; date: Date; offset: number }[] = []
  try {
    for (const key of Object.keys(localStorage)) {
      const match = /^sizzle:menu:(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(key)
      if (!match) continue
      const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)
      if (weekKey(date) !== key || date.getDay() !== 0) continue
      const week = read(key)
      if (!week.days.some((day) => day.length) && !week.notes.some(Boolean)) continue
      const current = sunday(0)
      const offset =
        (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
          Date.UTC(current.getFullYear(), current.getMonth(), current.getDate())) /
        (7 * 86400000)
      menus.push({ key, date, offset })
    }
  } catch {
    /* Browser storage may be blocked. */
  }
  // This array is new and contains only local history entries.
  // eslint-disable-next-line unicorn/no-array-sort
  return menus.sort((a, b) => b.date.getTime() - a.date.getTime())
}

function cardPosition(event: DragEvent<HTMLElement>, entries: Entry[], index: number) {
  const bounds = event.currentTarget.getBoundingClientRect()
  const edge = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after'
  return { edge, before: edge === 'before' ? entries[index].key : entries[index + 1]?.key } as const
}

export default function WeeklyMenu({ recipes }: { recipes: MenuRecipe[] }) {
  const [offset, setOffset] = useState(0)
  const date = sunday(offset)
  const storageKey = weekKey(date)
  return (
    <Menu key={storageKey} recipes={recipes} date={date} storageKey={storageKey} offset={offset} navigate={setOffset} />
  )
}
WeeklyMenu.layout = AppLayout

function Menu({
  recipes,
  date,
  storageKey,
  offset,
  navigate,
}: {
  recipes: MenuRecipe[]
  date: Date
  storageKey: string
  offset: number
  navigate: (offset: number) => void
}) {
  const [week, setWeek] = useState(() => read(storageKey))
  const [query, setQuery] = useState('')
  const [favorites, setFavorites] = useState(false)
  const [mealFilter, setMealFilter] = useState('')
  const [selectedDay, setSelectedDay] = useState(0)
  const [selectedMeal, setSelectedMeal] = useState<Meal>('Dinner')
  const [openNotes, setOpenNotes] = useState<number[]>([])
  const [drag, setDrag] = useState<{ recipeId: number; key?: string } | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const [overMeal, setOverMeal] = useState<string | null>(null)
  const [status, setStatus] = useState('Saved in this browser only.')
  const [duplicateNotice, setDuplicateNotice] = useState('')
  const [undoStack, setUndoStack] = useState<Week[]>([])
  const noteBefore = useRef<Week | null>(null)
  const [copySource, setCopySource] = useState('')
  const [confirmCopy, setConfirmCopy] = useState(false)
  const [insertion, setInsertion] = useState<{ key: string; edge: 'before' | 'after' } | null>(null)
  const pickerRef = useRef<HTMLElement>(null)
  const history = savedMenus()

  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]))
  const visible = recipes.filter(
    (recipe) =>
      recipe.title.toLowerCase().includes(query.toLowerCase()) &&
      (!favorites || recipe.favorite) &&
      (!mealFilter || recipe.meal_times.includes(mealFilter)),
  )
  const mostCooked = new Set(
    recipes
      .filter((recipe) => recipe.cooks_count > 0)
      // Sorting the freshly filtered copy leaves the recipe props unchanged.
      // eslint-disable-next-line unicorn/no-array-sort
      .sort((a, b) => b.cooks_count - a.cooks_count)
      .slice(0, 3)
      .map((recipe) => recipe.id),
  )
  const count = week.days.flat().filter((entry) => byId.has(entry.recipeId)).length
  const uniqueDays = week.days.map((entries) => uniqueMealEntries(entries, byId))
  const duplicateCount = week.days.flat().length - uniqueDays.flat().length
  function save(next: Week, message: string, remember = true) {
    setDuplicateNotice('')
    if (remember) setUndoStack((stack) => [...stack.slice(-19), week])
    setWeek(next)
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
      setStatus(`${message} Saved in this browser.`)
    } catch {
      setStatus(`${message} Browser storage is unavailable; keep this page open.`)
    }
  }
  function undo() {
    const previous = undoStack[undoStack.length - 1]
    if (!previous) return
    setUndoStack(undoStack.slice(0, -1))
    save(previous, 'Change undone.', false)
  }
  function copyMenu() {
    const source = read(copySource)
    save(
      {
        days: source.days.map((entries) =>
          uniqueMealEntries(
            entries.filter((entry) => byId.has(entry.recipeId)),
            byId,
          ).map((entry) => ({ ...entry, key: crypto.randomUUID() })),
        ),
        notes: [...source.notes],
      },
      'Menu copied. Each recipe appears once per meal.',
    )
    setConfirmCopy(false)
    setCopySource('')
  }
  function add(recipeId: number, day: number, key?: string, before?: string, meal?: Meal) {
    if (!byId.has(recipeId) || (key !== undefined && key === before)) return
    const days = week.days.map((entries) => entries.filter((entry) => entry.key !== key))
    const existing = week.days.flat().find((entry) => entry.key === key)
    const target = days[day].find((entry) => entry.key === before)
    const entry = {
      key: key ?? crypto.randomUUID(),
      recipeId,
      meal: meal ?? target?.meal ?? (target ? 'Dinner' : existing ? (existing.meal ?? 'Dinner') : selectedMeal),
    }
    if (
      days[day].some(
        (other) => (other.meal ?? 'Dinner') === entry.meal && sameRecipe(byId.get(other.recipeId), byId.get(recipeId)),
      )
    ) {
      setDuplicateNotice(
        `Already planned for ${DAYS[day]} ${entry.meal.toLowerCase()}.${existing ? ' Kept in its original place.' : ''}`,
      )
      return
    }
    const index = before ? days[day].findIndex((item) => item.key === before) : -1
    days[day].splice(index < 0 ? days[day].length : index, 0, entry)
    save({ ...week, days }, `${existing ? 'Moved' : 'Added'} to ${DAYS[day]} ${entry.meal.toLowerCase()}.`)
  }
  const endDrag = useCallback(() => {
    setDrag(null)
    setOverMeal(null)
    setOver(null)
    setInsertion(null)
  }, [])
  useEffect(() => {
    if (!drag) return
    const clearOutside = (event: globalThis.DragEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-menu-day]')) {
        setOver(null)
        setOverMeal(null)
        setInsertion(null)
      }
    }
    window.addEventListener('dragover', clearOutside)
    window.addEventListener('dragend', endDrag)
    window.addEventListener('drop', endDrag)
    return () => {
      window.removeEventListener('dragover', clearOutside)
      window.removeEventListener('dragend', endDrag)
      window.removeEventListener('drop', endDrag)
    }
  }, [drag, endDrag])
  function railMeal(event: DragEvent<HTMLElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const column = Math.floor(((event.clientX - bounds.left) / bounds.width) * MEALS.length)
    return MEALS[Math.max(0, Math.min(MEALS.length - 1, column))]
  }
  function chooseDay(day: number) {
    setSelectedDay(day)
    pickerRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
    pickerRef.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus({ preventScroll: true })
    setStatus(`Choose a recipe for ${DAYS[day]}.`)
  }
  function drop(day: number, before?: string, meal?: Meal) {
    if (drag) add(drag.recipeId, day, drag.key, before, meal)
    setDrag(null)
    setOverMeal(null)
    setOver(null)
    setInsertion(null)
  }
  const end = new Date(date)
  end.setDate(date.getDate() + 6)
  return (
    <div className="weekly-menu-page">
      <Link href="/" className="text-sm text-graphite hover:underline">
        ← Your cookbook
      </Link>
      <div className="mt-5 mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold sm:text-5xl">Weekly menu</h1>
        </div>
      </div>
      <div className="weekly-menu-columns grid items-start gap-7 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)]">
        <section
          ref={pickerRef}
          aria-label="Recipe picker"
          className="flex scroll-mt-24 flex-col rounded-2xl border border-hairline bg-paper p-4 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)]"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold">Recipes</h2>
            <span className="text-xs text-graphite">{recipes.length} recipes</span>
          </div>
          <input
            type="search"
            aria-label="Find a recipe"
            placeholder="Find a recipe…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-xl border-hairline bg-paper px-4 py-3"
          />
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Filter recipes by meal">
            {['', ...MEALS].map((meal) => (
              <button
                key={meal}
                aria-pressed={mealFilter === meal.toLowerCase()}
                onClick={() => {
                  setMealFilter(meal.toLowerCase())
                  if (meal) setSelectedMeal(meal as Meal)
                }}
                className={`rounded-full px-3 py-2 text-xs ring-1 ring-hairline ${mealFilter === meal.toLowerCase() ? 'bg-active text-on-active' : 'bg-paper text-graphite'}`}
              >
                {meal || 'All meals'}
              </button>
            ))}
            <button
              aria-pressed={favorites}
              onClick={() => setFavorites(!favorites)}
              className={`rounded-full px-3 py-2 text-xs ring-1 ring-hairline ${favorites ? 'bg-active text-on-active' : 'bg-paper'}`}
            >
              ♥ Favourites
            </button>
          </div>
          <div className="my-3 grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 rounded-xl bg-porcelain p-2 text-sm">
            <label className="contents">
              <span className="text-xs text-graphite">Add to</span>
              <select
                aria-label="Add recipes to day"
                value={selectedDay}
                onChange={(event) => setSelectedDay(Number(event.target.value))}
                className="min-w-0 rounded-lg border-hairline bg-paper py-2 pr-6 pl-2 text-xs"
              >
                {DAYS.map((day, index) => (
                  <option key={day} value={index}>
                    {day}
                  </option>
                ))}
              </select>
            </label>
            <label className="contents">
              <span className="sr-only">Meal</span>
              <select
                aria-label="Meal for new recipes"
                value={selectedMeal}
                onChange={(event) => setSelectedMeal(event.target.value as Meal)}
                className="min-w-0 rounded-lg border-hairline bg-paper py-2 pr-6 pl-2 text-xs"
              >
                {MEALS.map((meal) => (
                  <option key={meal}>{meal}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="mb-3 text-xs text-graphite">Drag to a meal, or tap + to add to {DAYS[selectedDay]}.</p>
          <div className="min-h-0 max-h-80 flex-1 space-y-2 overflow-y-auto overscroll-contain p-1 lg:max-h-none">
            {visible.map((recipe) => (
              <article
                key={recipe.id}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/plain', String(recipe.id))
                  event.dataTransfer.effectAllowed = 'copy'
                  setDrag({ recipeId: recipe.id })
                }}
                onDragEnd={endDrag}
                className={`flex cursor-grab items-center gap-3 rounded-xl p-2 ring-1 active:cursor-grabbing ${recipe.favorite || mostCooked.has(recipe.id) ? 'bg-mark/20 ring-ink/20' : 'bg-paper ring-hairline'}`}
              >
                <Photo recipe={recipe} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/recipes/${recipe.id}`}
                    draggable={false}
                    className="line-clamp-2 text-sm font-semibold hover:underline"
                  >
                    {recipe.title}
                  </Link>
                  <p className="mt-1 text-xs text-graphite">
                    {[recipe.total_minutes ? `${recipe.total_minutes} min` : null, recipe.cuisine]
                      .filter(Boolean)
                      .join(' · ') || 'Saved recipe'}
                  </p>
                  {(recipe.favorite || mostCooked.has(recipe.id)) && (
                    <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-ink">
                      {recipe.favorite && <span>♥ Favourite</span>}
                      {mostCooked.has(recipe.id) && (
                        <span>
                          Most cooked · {recipe.cooks_count} {recipe.cooks_count === 1 ? 'cook' : 'cooks'}
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <button
                  aria-label={`Add ${recipe.title} to ${DAYS[selectedDay]}`}
                  onClick={() => add(recipe.id, selectedDay)}
                  className="size-10 shrink-0 rounded-full bg-porcelain text-xl hover:bg-mark"
                >
                  +
                </button>
              </article>
            ))}
            {!visible.length && (
              <p className="py-8 text-center text-sm text-graphite">
                {recipes.length
                  ? 'No recipes match. Try another search.'
                  : 'Add some recipes to your cookbook to start planning.'}
              </p>
            )}
          </div>
        </section>
        <section
          aria-label="Weekly menu"
          className="weekly-menu-sheet rounded-t-[3rem] rounded-b-lg border border-hairline bg-paper p-5 shadow-sm sm:p-9"
        >
          <div className="menu-screen-only mb-5 flex flex-wrap items-center justify-between gap-2">
            <details className="relative z-30">
              <summary className="cursor-pointer list-none rounded-full px-3 py-2 text-sm ring-1 ring-hairline hover:bg-porcelain">
                Saved menus <span aria-hidden="true">⌄</span>
              </summary>
              <div className="absolute left-0 top-full mt-2 w-64 rounded-2xl border border-hairline bg-paper p-4 shadow-lg">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="text-xs text-graphite">
                    View a saved week
                    <select
                      aria-label="View saved menu"
                      value={history.some((item) => item.key === storageKey) ? storageKey : ''}
                      onChange={(event) => {
                        const selected = history.find((item) => item.key === event.target.value)
                        if (selected) navigate(selected.offset)
                      }}
                      className="ml-2 max-w-48 rounded-lg border-hairline bg-porcelain py-1.5 text-xs"
                    >
                      <option value="" disabled>
                        {history.length ? 'Choose a week' : 'No saved menus yet'}
                      </option>
                      {history.map((item) => (
                        <option key={item.key} value={item.key}>
                          {format(item.date)}, {item.date.getFullYear()}
                        </option>
                      ))}
                    </select>
                  </label>
                  {offset !== 0 && (
                    <button onClick={() => navigate(0)} className="rounded-full px-3 py-2 text-xs ring-1 ring-hairline">
                      This week
                    </button>
                  )}
                </div>
                {history.some((item) => item.key !== storageKey) && (
                  <div className="menu-screen-only my-5 flex flex-wrap items-center justify-center gap-2">
                    <select
                      aria-label="Copy menu from week"
                      value={copySource}
                      onChange={(event) => {
                        setCopySource(event.target.value)
                        setConfirmCopy(false)
                      }}
                      className="max-w-full rounded-lg border-hairline bg-porcelain py-2 text-xs"
                    >
                      <option value="">Copy a saved menu…</option>
                      {history
                        .filter((item) => item.key !== storageKey)
                        .map((item) => (
                          <option key={item.key} value={item.key}>
                            {format(item.date)}, {item.date.getFullYear()}
                          </option>
                        ))}
                    </select>
                    <button
                      disabled={!copySource}
                      onClick={() => {
                        if (count || week.notes.some(Boolean)) setConfirmCopy(true)
                        else copyMenu()
                      }}
                      className="rounded-full px-3 py-2 text-xs ring-1 ring-hairline disabled:opacity-40"
                    >
                      Copy menu
                    </button>
                    {confirmCopy && (
                      <div className="w-full rounded-xl bg-porcelain p-3 text-center text-sm">
                        <p>Replace this week’s recipes and notes with the saved menu?</p>
                        <div className="mt-3 flex justify-center gap-3">
                          <button onClick={copyMenu} className="rounded-full bg-action px-4 py-2 text-on-action">
                            Replace menu
                          </button>
                          <button
                            onClick={() => setConfirmCopy(false)}
                            className="rounded-full px-4 py-2 ring-1 ring-hairline"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </details>
            <WeeklyMenuPrint days={week.days} notes={week.notes} recipes={recipes} date={date} />
          </div>
          <header className="border-b border-ink/20 pb-5 text-center">
            <p className="text-[10px] font-semibold tracking-[0.3em] text-graphite uppercase">The Sizzle kitchen</p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {offset === 0 ? 'This week’s menu' : 'Weekly menu'}
            </h2>
            <div className="mx-auto mt-4 flex w-fit max-w-full items-center gap-1 rounded-full bg-paper p-1.5 ring-1 ring-hairline">
              <button
                aria-label="Previous week"
                className="rounded-full px-2 py-2 hover:bg-mark"
                onClick={() => navigate(offset - 1)}
              >
                ←
              </button>
              <span className="text-xs font-semibold sm:text-sm">
                {format(date)} – {format(end)}, {end.getFullYear()}
              </span>
              <button
                aria-label="Next week"
                className="rounded-full px-2 py-2 hover:bg-mark"
                onClick={() => navigate(offset + 1)}
              >
                →
              </button>
            </div>
          </header>
          <p className="menu-screen-only my-4 text-center text-xs text-graphite">
            Drag recipes to a meal or rearrange them within your menu.
          </p>
          {duplicateCount > 0 && (
            <div className="menu-screen-only mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-mark/30 p-4 text-sm">
              <p>
                {duplicateCount} extra {duplicateCount === 1 ? 'copy' : 'copies'} in the same meal. Keep one of each?
              </p>
              <button
                onClick={() => save({ ...week, days: uniqueDays }, 'Duplicate entries removed.')}
                className="shrink-0 rounded-full bg-paper px-4 py-2 font-semibold ring-1 ring-hairline hover:bg-mark"
              >
                Remove duplicates
              </button>
            </div>
          )}
          <div className="space-y-6">
            {DAYS.map((day, dayIndex) => {
              const dayDate = new Date(date)
              dayDate.setDate(date.getDate() + dayIndex)
              const dayCount = week.days[dayIndex].filter((entry) => byId.has(entry.recipeId)).length
              return (
                <section
                  key={day}
                  id={`menu-day-${dayIndex}`}
                  data-menu-day={dayIndex}
                  aria-label={day}
                  onDragOver={(event) => {
                    if (drag) {
                      event.preventDefault()
                      event.dataTransfer.dropEffect = 'none'
                      setOver(dayIndex)
                      setOverMeal(null)
                      setInsertion(null)
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    endDrag()
                  }}
                  className={`rounded-2xl border border-hairline bg-porcelain p-3 shadow-sm sm:p-4 ${over === dayIndex ? 'ring-2 ring-active/40' : ''}`}
                >
                  <div className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-10 -mx-3 -mt-3 mb-3 flex min-h-14 flex-wrap items-center gap-2 rounded-t-2xl border-b border-hairline bg-paper px-3 py-3 sm:-mx-4 sm:-mt-4 sm:px-4">
                    <h3 className="font-display text-xl font-semibold text-ink">{day}</h3>
                    <span className="rounded-full border border-hairline bg-porcelain px-2.5 py-1 text-[11px] whitespace-nowrap text-graphite">
                      {format(dayDate)}
                    </span>
                    <span className="ml-auto hidden text-xs text-graphite sm:block">
                      {dayCount} {dayCount === 1 ? 'recipe' : 'recipes'}
                    </span>
                    {!week.notes[dayIndex] && !openNotes.includes(dayIndex) && (
                      <button
                        aria-label={`Add note for ${day}`}
                        onClick={() => setOpenNotes([...openNotes, dayIndex])}
                        className="ml-auto rounded-lg px-2 py-2 text-xs text-graphite hover:bg-porcelain hover:text-ink sm:ml-1"
                      >
                        + Note
                      </button>
                    )}
                  </div>
                  <div className="relative mt-2 h-12" data-meal-rail={dayIndex}>
                    <button
                      onClick={() => chooseDay(dayIndex)}
                      className={`absolute inset-0 w-full rounded-xl border border-dashed border-hairline text-sm text-graphite hover:border-ink/30 hover:bg-porcelain ${drag ? 'invisible' : ''}`}
                      aria-label={`Add a recipe for ${day}`}
                    >
                      + Add a recipe
                    </button>
                    {drag && (
                      <div
                        className="absolute inset-0 grid grid-cols-4 gap-1"
                        aria-label={`Meal targets for ${day}`}
                        onDragOver={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          event.dataTransfer.dropEffect = drag.key ? 'move' : 'copy'
                          setOver(dayIndex)
                          setOverMeal(`${dayIndex}:${railMeal(event)}`)
                          setInsertion(null)
                        }}
                        onDrop={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          drop(dayIndex, undefined, railMeal(event))
                        }}
                      >
                        {MEALS.map((meal) => (
                          <div
                            key={meal}
                            data-meal-drop={`${dayIndex}:${meal}`}
                            aria-label={`Drop into ${day} ${meal}`}
                            className={`flex min-w-0 items-center justify-center rounded-lg border text-[11px] sm:text-xs ${overMeal === `${dayIndex}:${meal}` ? 'border-active bg-active text-on-active' : 'border-dashed border-hairline bg-porcelain text-ink'}`}
                          >
                            {meal}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 [&:not(:empty)]:mt-3">
                    {MEALS.map((meal) => {
                      const entries = week.days[dayIndex].filter(
                        (entry) => (entry.meal ?? 'Dinner') === meal && byId.has(entry.recipeId),
                      )
                      if (!entries.length) return null
                      return (
                        <section
                          key={meal}
                          aria-label={`${day} ${meal}`}
                          onDragOver={(event) => {
                            if (!drag) return
                            event.preventDefault()
                            event.stopPropagation()
                            event.dataTransfer.dropEffect = drag.key ? 'move' : 'copy'
                            setOver(dayIndex)
                            setOverMeal(`${dayIndex}:${meal}`)
                            setInsertion(null)
                          }}
                          onDrop={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            drop(dayIndex, undefined, meal)
                          }}
                          className={`rounded-xl border border-transparent px-2 py-3 ${overMeal === `${dayIndex}:${meal}` ? 'bg-mark/20 ring-1 ring-inset ring-active/50' : ''}`}
                        >
                          <h4 className="mb-2 text-[11px] font-semibold tracking-[0.1em] text-graphite uppercase">
                            {meal}
                          </h4>
                          <div className="space-y-2">
                            {entries.map((entry, index) => {
                              const recipe = byId.get(entry.recipeId)
                              if (!recipe) return null
                              return (
                                <article
                                  key={entry.key}
                                  draggable
                                  onDragStart={(event) => {
                                    event.dataTransfer.setData('text/plain', entry.key)
                                    event.dataTransfer.effectAllowed = 'move'
                                    setDrag({ recipeId: entry.recipeId, key: entry.key })
                                  }}
                                  onDragEnd={endDrag}
                                  onDragOver={(event) => {
                                    if (!drag) return
                                    event.preventDefault()
                                    event.stopPropagation()
                                    event.dataTransfer.dropEffect = drag.key ? 'move' : 'copy'
                                    setOver(dayIndex)
                                    setOverMeal(`${dayIndex}:${meal}`)
                                    const edge = cardPosition(event, entries, index).edge
                                    setInsertion((previous) =>
                                      previous?.key === entry.key && previous.edge === edge
                                        ? previous
                                        : { key: entry.key, edge },
                                    )
                                  }}
                                  onDrop={(event) => {
                                    event.preventDefault()
                                    event.stopPropagation()
                                    drop(dayIndex, cardPosition(event, entries, index).before, meal)
                                  }}
                                  className="group relative flex cursor-grab items-start gap-3 border-b border-hairline/60 px-1 py-3 last:border-0"
                                >
                                  {drag && insertion?.key === entry.key && drag.key !== entry.key && (
                                    <span
                                      aria-hidden="true"
                                      className={`pointer-events-none absolute inset-x-0 h-0.5 rounded-full bg-active ${insertion.edge === 'before' ? 'top-0' : 'bottom-0'}`}
                                    />
                                  )}
                                  <MenuPhoto recipe={recipe} />
                                  <div className="min-w-0 flex-1 pr-10">
                                    <Link
                                      href={`/recipes/${recipe.id}`}
                                      draggable={false}
                                      className="block font-display text-lg leading-snug font-semibold hover:underline"
                                    >
                                      {recipe.title}
                                    </Link>
                                    {recipe.description && (
                                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-graphite">
                                        {recipe.description}
                                      </p>
                                    )}
                                    {recipe.total_minutes && (
                                      <p className="mt-2 text-[11px] text-graphite">{recipe.total_minutes} min</p>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    aria-label={`Remove ${recipe.title} from ${day}`}
                                    title="Remove from menu"
                                    onClick={() =>
                                      save(
                                        {
                                          ...week,
                                          days: week.days.map((dayEntries) =>
                                            dayEntries.filter((item) => item.key !== entry.key),
                                          ),
                                        },
                                        'Recipe removed.',
                                      )
                                    }
                                    className="absolute top-1 right-0 flex size-11 cursor-pointer items-center justify-center rounded-full text-graphite hover:bg-mark hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active"
                                  >
                                    <Icon name="close" className="size-4" />
                                  </button>
                                </article>
                              )
                            })}
                          </div>
                        </section>
                      )
                    })}
                  </div>
                  {openNotes.includes(dayIndex) && (
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                      {['Leftovers', 'Eating out'].map((note) => (
                        <button
                          key={note}
                          onPointerDown={(event) => event.preventDefault()}
                          onClick={() => {
                            save(
                              { ...week, notes: week.notes.map((text, i) => (i === dayIndex ? note : text)) },
                              'Note added.',
                            )
                            setOpenNotes(openNotes.filter((index) => index !== dayIndex))
                            noteBefore.current = null
                          }}
                          className="rounded-full bg-porcelain px-3 py-2 text-xs ring-1 ring-hairline"
                        >
                          {note}
                        </button>
                      ))}
                    </div>
                  )}
                  {(week.notes[dayIndex] || openNotes.includes(dayIndex)) && (
                    <input
                      ref={(node) => {
                        if (node && openNotes.includes(dayIndex)) node.focus()
                      }}
                      onFocus={() => {
                        noteBefore.current = week
                        setOpenNotes((indices) => (indices.includes(dayIndex) ? indices : [...indices, dayIndex]))
                      }}
                      onBlur={() => {
                        const previous = noteBefore.current
                        if (previous && JSON.stringify(previous) !== JSON.stringify(week))
                          setUndoStack((stack) => [...stack.slice(-19), previous])
                        noteBefore.current = null
                        setOpenNotes(openNotes.filter((index) => index !== dayIndex))
                      }}
                      aria-label={`${day} note`}
                      placeholder="Leftovers, eating out, or a note…"
                      maxLength={200}
                      value={week.notes[dayIndex]}
                      onChange={(event) =>
                        save(
                          { ...week, notes: week.notes.map((note, i) => (i === dayIndex ? event.target.value : note)) },
                          'Note updated.',
                          false,
                        )
                      }
                      className="mt-2 w-full rounded-lg border-transparent bg-transparent px-1 py-1 text-center text-sm italic placeholder:text-graphite focus:border-hairline focus:bg-porcelain focus:ring-0"
                    />
                  )}
                </section>
              )
            })}
          </div>
          <p className="menu-screen-only mt-7 border-t border-hairline pt-5 text-center text-xs text-graphite">
            {count} {count === 1 ? 'recipe' : 'recipes'} planned
          </p>
          {(duplicateNotice || undoStack.length > 0) && !drag && (
            <div className="menu-screen-only fixed right-4 bottom-4 z-30 flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-3 rounded-2xl bg-paper p-3 text-sm text-ink shadow-lg ring-1 ring-hairline">
              {duplicateNotice && (
                <>
                  <p role="status" className="max-w-72">
                    {duplicateNotice}
                  </p>
                  <button
                    onClick={() => setDuplicateNotice('')}
                    aria-label="Dismiss duplicate notice"
                    className="rounded-full px-3 py-2 hover:bg-mark"
                  >
                    ×
                  </button>
                </>
              )}
              {undoStack.length > 0 && (
                <button onClick={undo} className="rounded-full px-3 py-2 font-semibold hover:bg-mark">
                  Undo last change
                </button>
              )}
            </div>
          )}
          <p role="status" className="menu-screen-only mt-3 text-center text-xs text-graphite">
            {status}
          </p>
        </section>
      </div>
    </div>
  )
}
function Photo({ recipe }: { recipe: RecipeCard }) {
  return recipe.image_url ? (
    <img src={recipe.image_url} alt="" draggable={false} className="size-12 shrink-0 rounded-lg object-cover" />
  ) : (
    <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-mark text-xl">
      ♧
    </span>
  )
}

function MenuPhoto({ recipe }: { recipe: RecipeCard }) {
  const sizing = 'size-12 shrink-0 rounded-full'
  return recipe.image_url ? (
    <img src={recipe.image_url} alt="" draggable={false} className={`${sizing} object-cover`} />
  ) : (
    <span aria-hidden="true" className={`${sizing} flex items-center justify-center bg-mark text-xl`}>
      ♧
    </span>
  )
}
