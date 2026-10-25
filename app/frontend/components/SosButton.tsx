import { router } from '@inertiajs/react'
import Icon from '@/components/Icon'
import { currentMoment } from '@/lib/mealMoment'
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
  const { meal, season } = currentMoment()
  const active = filters.meal === meal && filters.season === season
  const question = QUESTIONS[meal]

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${question} Show ${meal} recipes for ${season}`}
      title={question}
      onClick={() =>
        router.get(
          '/',
          active ? {} : { meal, season },
          inGallery ? { preserveState: true, preserveScroll: true, replace: true } : {},
        )
      }
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full p-2 text-sm sm:py-2 sm:pr-3.5 sm:pl-3 transition-colors ${
        active ? 'bg-active font-medium text-on-active' : 'bg-paper text-ink ring-1 ring-hairline hover:ring-ink/30'
      }`}
    >
      <Icon name="lifebuoy" className="size-5 sm:size-4" />
      <span className="hidden font-medium sm:inline">{question}</span>
    </button>
  )
}
