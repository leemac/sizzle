import { INGREDIENT_ICONS, ingredientIcon } from '@/lib/ingredientIcons'

/** A small picture of an ingredient, or a quiet dot when no icon fits, so rows keep their rhythm. */
export default function IngredientIcon({ item, className = 'size-5' }: { item: string; className?: string }) {
  const name = ingredientIcon(item)
  if (!name) {
    return (
      <span className={`grid place-items-center ${className}`} aria-hidden="true" data-ingredient-icon="none">
        <span className="size-1 rounded-full bg-current opacity-60" />
      </span>
    )
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      data-ingredient-icon={name}
    >
      <path d={INGREDIENT_ICONS[name].d} />
    </svg>
  )
}
