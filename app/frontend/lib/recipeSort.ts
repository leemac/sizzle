import type { RecipeSort } from '@/types'

export const RECIPE_SORTS: { value: RecipeSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'alphabetical', label: 'Alphabetical' },
  { value: 'recently_cooked', label: 'Recently cooked' },
  { value: 'never_cooked', label: 'Never cooked first' },
]
