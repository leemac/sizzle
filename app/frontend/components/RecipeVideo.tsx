import Icon from '@/components/Icon'
import type { RecipeDetail } from '@/types'

type VideoRecipe = Pick<
  RecipeDetail,
  'youtube_url' | 'youtube_duration_seconds' | 'youtube_chapters' | 'written_recipe_url'
>

export function videoTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = String(seconds % 60).padStart(2, '0')
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`
}

export default function RecipeVideo({ recipe }: { recipe: VideoRecipe }) {
  if (!recipe.youtube_url) return null

  return (
    <aside aria-label="Video directions" className="mb-8 rounded-2xl bg-paper ring-1 ring-hairline">
      <a
        href={recipe.youtube_url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="flex items-center gap-4 rounded-2xl p-4 hover:bg-ink/5"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full ring-1 ring-hairline">
          <Icon name="play" className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">Watch on YouTube</span>
          <span className="block text-sm text-graphite">
            Video directions
            {recipe.youtube_duration_seconds != null && ` · ${videoTimestamp(recipe.youtube_duration_seconds)} video`}
          </span>
        </span>
        <Icon name="external" className="size-4 shrink-0" />
      </a>

      {recipe.written_recipe_url && (
        <a
          href={recipe.written_recipe_url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="mx-4 mb-4 flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm hover:bg-ink/5"
        >
          <Icon name="link" className="size-4 shrink-0" />
          <span className="flex-1">Written recipe</span>
          <Icon name="external" className="size-4 shrink-0" />
        </a>
      )}

      {recipe.youtube_chapters.length > 0 && (
        <details className="border-t border-hairline p-4">
          <summary className="cursor-pointer rounded-lg py-2 text-sm font-medium">Video chapters</summary>
          <ol className="mt-2 space-y-1">
            {recipe.youtube_chapters.map((chapter) => (
              <li key={chapter.start_seconds}>
                <a
                  href={chapter.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="flex min-h-11 items-start gap-3 rounded-lg px-2 py-3 text-sm hover:bg-ink/5"
                >
                  <span className="shrink-0 text-graphite tabular-nums">{videoTimestamp(chapter.start_seconds)}</span>
                  <span className="min-w-0 flex-1 break-words">{chapter.title}</span>
                  <Icon name="external" className="mt-0.5 size-3.5 shrink-0" />
                </a>
              </li>
            ))}
          </ol>
        </details>
      )}
    </aside>
  )
}
