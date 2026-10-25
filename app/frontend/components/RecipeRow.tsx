import { Link } from '@inertiajs/react'
import Icon from '@/components/Icon'
import { RecipePhoto } from '@/components/RecipeTile'
import { formatMinutes } from '@/lib/format'
import type { RecipeCard } from '@/types'

// Gallery list row: thumbnail beside the title, for scanning a big collection.
export default function RecipeRow({ recipe }: { recipe: RecipeCard }) {
  const time = formatMinutes(recipe.total_minutes)

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="group flex items-center gap-4 rounded-photo bg-paper p-2 pr-4 ring-1 ring-hairline hover:ring-ink/30"
    >
      <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-hairline sm:size-24">
        <RecipePhoto recipe={recipe} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 font-display text-base leading-snug font-semibold">{recipe.title}</h3>
        {recipe.cuisine && <p className="mt-0.5 text-sm text-graphite">{recipe.cuisine}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5 self-start pt-1 text-xs text-graphite">
        {time && (
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <Icon name="clock" className="size-3" />
            {time}
          </span>
        )}
        {recipe.favorite && (
          <span className="text-accent">
            <Icon name="heart" filled className="size-4" />
            <span className="sr-only">Favorite</span>
          </span>
        )}
      </div>
    </Link>
  )
}
