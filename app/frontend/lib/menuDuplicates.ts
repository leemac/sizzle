import type { MenuRecipe } from '@/types'

type PlannedRecipe = { recipeId: number; meal?: string }
type Identity = Pick<MenuRecipe, 'id' | 'signature_keys'>

export function sameRecipe(a: Identity | undefined, b: Identity | undefined): boolean {
  return !!a && !!b && (a.id === b.id || a.signature_keys.some((key) => b.signature_keys.includes(key)))
}

// Keep the first copy in each meal. Repeating a recipe in other meals or days is intentional.
export function uniqueMealEntries<T extends PlannedRecipe>(entries: T[], recipes: Map<number, Identity>): T[] {
  const kept: T[] = []
  for (const entry of entries) {
    if (
      !kept.some(
        (other) =>
          (other.meal ?? 'Dinner') === (entry.meal ?? 'Dinner') &&
          sameRecipe(recipes.get(other.recipeId), recipes.get(entry.recipeId)),
      )
    )
      kept.push(entry)
  }
  return kept
}
