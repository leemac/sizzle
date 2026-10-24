import { Link } from '@inertiajs/react'
import Icon from '@/components/Icon'
import { formatMinutes } from '@/lib/format'
import type { RecipeCard } from '@/types'

const PILL = 'absolute top-2.5 inline-flex h-7 items-center rounded-full bg-black/70 text-white backdrop-blur-sm'

// Gallery grid card: the photo fills the card and the title sits on a black
// band that feathers into it. Time and favorite ride on top as pills.
export default function RecipeTile({ recipe }: { recipe: RecipeCard }) {
  const time = formatMinutes(recipe.total_minutes)

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="group relative block aspect-[4/5] overflow-hidden rounded-photo bg-hairline"
    >
      <RecipePhoto recipe={recipe} />
      {recipe.favorite && (
        <span className={`${PILL} left-2.5 w-7 justify-center text-yolk`}>
          <Icon name="heart" filled className="size-3.5" />
          <span className="sr-only">Favorite</span>
        </span>
      )}
      {time && (
        <span className={`${PILL} right-2.5 gap-1 px-2.5 text-xs font-medium`}>
          <Icon name="clock" className="size-3" />
          {time}
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-black/85 px-3 py-2.5 before:absolute before:inset-x-0 before:bottom-full before:h-8 before:bg-gradient-to-t before:from-black/85 before:to-transparent sm:px-4 sm:py-3">
        <h3 className="line-clamp-2 font-display text-base leading-tight font-semibold text-balance text-white sm:text-lg">
          {recipe.title}
        </h3>
        {recipe.cuisine && <p className="mt-0.5 text-xs text-white/70 sm:text-sm">{recipe.cuisine}</p>}
      </div>
    </Link>
  )
}

export function RecipePhoto({ recipe }: { recipe: RecipeCard }) {
  return recipe.image_url ? (
    <img
      src={recipe.image_url}
      alt=""
      loading="lazy"
      decoding="async"
      className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
    />
  ) : (
    <div className="flex size-full items-start bg-paper p-4">
      <span className="font-display text-6xl leading-none font-bold text-hairline">{recipe.title.charAt(0)}</span>
    </div>
  )
}
