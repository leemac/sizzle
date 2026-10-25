// Prop shapes sent by the Rails controllers. Keep in sync with
// app/serializers/*.rb — those are the source of truth.

export type FlashData = {
  notice?: string
  alert?: string
}

export type SharedProps = {
  app: { claude_configured: boolean; version: string }
}

export type SetupStatus = {
  claude_configured: boolean
  version: string
}

export type ManualRecipeInput = {
  title: string
  description: string
  ingredients: string
  steps: string
  servings: string
  prep_minutes: string
  cook_minutes: string
  source_url: string
}

export type RecipeCard = {
  id: number
  title: string
  cuisine: string | null
  course: string | null
  total_minutes: number | null
  source_host: string | null
  favorite: boolean
  image_url: string | null
}

export type Ingredient = {
  section: string | null
  quantity: number | null
  quantity_max: number | null
  unit: string | null
  item: string
  preparation: string | null
  note: string | null
}

export type Step = {
  section: string | null
  text: string
}

export type RecipeDetail = RecipeCard & {
  description: string | null
  author: string | null
  source_url: string | null
  source_name: string | null
  youtube_url: string | null
  youtube_duration_seconds: number | null
  youtube_chapters: VideoChapter[]
  written_recipe_url: string | null
  servings: number | null
  yield_text: string | null
  prep_minutes: number | null
  cook_minutes: number | null
  main_ingredient: string | null
  diets: string[]
  tags: string[]
  ingredients: Ingredient[]
  steps: Step[]
  tips: string[]
  notes: string | null
  rating: number | null
  hero_url: string | null
  photo_urls: string[]
  created_at: string
  edited_at: string | null
  cooks_count: number
  last_cook: Cook | null
  archived: boolean
}

export type Cook = {
  id: number
  cooked_at: string
}

export type VideoChapter = {
  title: string
  start_seconds: number
  url: string
}

export type RecipeEditInput = ManualRecipeInput & {
  total_minutes: string
  cuisine: string
  course: string
  main_ingredient: string
  tips: string
  notes: string
}

export type RecipeEditForm = {
  id: number
  title: string
  fields: RecipeEditInput
  courses: string[]
}

export type ImportStatus = 'queued' | 'fetching' | 'extracting' | 'saving' | 'done' | 'failed'

export type Import = {
  id: number
  kind: 'url' | 'text'
  origin: 'web' | 'share' | 'email'
  url: string | null
  text_preview: string | null
  status: ImportStatus
  error: string | null
  recipe_id: number | null
  recipe_title: string | null
  recipe_image_url: string | null
  created_at: string
}

export type ImportReview = {
  token: string
  entries: {
    key: string
    url: string
    occurrences: number
    recipe_id: number | null
    recipe_title: string | null
    archived: boolean
    pending_id: number | null
  }[]
}

export type SourceDuplicate = {
  id: number
  title: string
  archived: boolean
}

export type FacetCount = { value: string; count: number }

export type Facets = {
  favorites: number
  courses: FacetCount[]
  cuisines: FacetCount[]
  main_ingredients: FacetCount[]
  diets: FacetCount[]
  max_minutes: number[]
}

export type RecipeFilters = {
  q?: string
  favorites?: string
  course?: string
  cuisine?: string
  diet?: string
  main?: string
  max_minutes?: string
}
