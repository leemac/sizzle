import { Link } from '@inertiajs/react'
import Icon from '@/components/Icon'
import { formatMinutes } from '@/lib/format'
import type { RecipeCard } from '@/types'

export default function RecipeTile({ recipe }: { recipe: RecipeCard }) {
  const time = formatMinutes(recipe.total_minutes)

  return (
    <Link href={`/recipes/${recipe.id}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden rounded-photo bg-hairline">
        {recipe.image_url ? (
          <img
            src={recipe.image_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex size-full items-end bg-paper p-4">
            <span className="font-display text-7xl leading-none font-bold text-hairline">{recipe.title.charAt(0)}</span>
          </div>
        )}
        {recipe.favorite && (
          <span className="absolute top-2.5 right-2.5 grid size-8 place-items-center rounded-full bg-paper/90 text-yolk shadow-sm">
            <Icon name="heart" filled className="size-4" />
            <span className="sr-only">Favorite</span>
          </span>
        )}
      </div>
      <h3 className="mt-3 line-clamp-2 font-display text-lg leading-snug font-semibold text-balance">{recipe.title}</h3>
      <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-graphite">
        {time && <span>{time}</span>}
        {recipe.cuisine && <span>{recipe.cuisine}</span>}
      </p>
    </Link>
  )
}
