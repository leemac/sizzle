import { router } from '@inertiajs/react'
import Icon from '@/components/Icon'
import { currentMoment } from '@/lib/mealMoment'
import type { MealTime, RecipeFilters } from '@/types'

// The question on wide screens, then the short form that fits a phone's header.
const LABELS: Record<MealTime, [string, string]> = {
  breakfast: ['What’s for breakfast?', 'Breakfast?'],
  lunch: ['What’s for lunch?', 'Lunch?'],
  dinner: ['What’s for dinner?', 'Dinner?'],
  snack: ['Need a snack?', 'Snack?'],
}

/**
 * "What can I make right now?" Shows recipes for the meal at this hour, with
 * this season's first, using the browser's clock. Pressing it again clears it.
 * Lives in the header, so from any other page it opens the gallery.
 */
export default function SosButton({ filters, inGallery }: { filters: RecipeFilters; inGallery: boolean }) {
  const { meal, season } = currentMoment()
  const active = filters.meal === meal && filters.season === season
  const [question, short] = LABELS[meal]

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${question} Show ${meal} recipes for ${season}`}
      onClick={() =>
        router.get(
          '/',
          active ? {} : { meal, season },
          inGallery ? { preserveState: true, preserveScroll: true, replace: true } : {},
        )
      }
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm sm:pr-3.5 transition-colors ${
        active ? 'bg-yolk font-medium text-[#18181b]' : 'bg-paper text-ink ring-1 ring-hairline hover:ring-ink/30'
      }`}
    >
      <Icon name="lifebuoy" className="hidden size-4 sm:block" />
      <span className="font-medium sm:hidden">{short}</span>
      <span className="hidden font-medium sm:inline">{question}</span>
    </button>
  )
}
