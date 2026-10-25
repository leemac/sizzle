import { router } from '@inertiajs/react'
import Icon from '@/components/Icon'
import { currentMoment } from '@/lib/mealMoment'
import { useCurrentMoment } from '@/lib/useCurrentMoment'
import type { MealTime, RecipeFilters } from '@/types'

const QUESTIONS: Record<MealTime, string> = {
  breakfast: 'What’s for breakfast?',
  lunch: 'What’s for lunch?',
  dinner: 'What’s for dinner?',
  snack: 'Need a snack?',
}

/**
 * "What can I make right now?" Shows recipes for the meal at this hour, with
 * this season's first, using the browser's clock. Pressing it again clears it.
 * Lives in the header, so from any other page it opens the gallery. Phones only
 * have room for the icon.
 */
export default function SosButton({ filters, inGallery }: { filters: RecipeFilters; inGallery: boolean }) {
  const { meal, season } = useCurrentMoment()
  const active = filters.meal === meal && filters.season === season
  const question = QUESTIONS[meal]

  // Read the clock again on click, in case the label hasn't caught up with it yet.
  const visit = () => {
    const now = currentMoment()
    const showing = filters.meal === now.meal && filters.season === now.season
    router.get('/', showing ? {} : now, inGallery ? { preserveState: true, preserveScroll: true, replace: true } : {})
  }

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${question} Show ${meal} recipes for ${season}`}
      title={question}
      onClick={visit}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full p-2 text-sm sm:py-2 sm:pr-3.5 sm:pl-3 transition-colors ${
        active ? 'bg-active font-medium text-on-active' : 'text-graphite hover:bg-paper hover:text-ink'
      }`}
    >
      <Icon name="lifebuoy" className="size-5 sm:size-4" />
      <span className="hidden font-medium sm:inline">{question}</span>
    </button>
  )
}
