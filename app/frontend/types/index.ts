// Prop shapes sent by the Rails controllers. Keep in sync with
// app/serializers/*.rb — those are the source of truth.

export type FlashData = {
  notice?: string
  alert?: string
}

export type ThemeMode = 'light' | 'dark' | 'auto'

export type Appearance = {
  theme: string
  mode: ThemeMode
  chosen: boolean
  /** The theme's page background in light and dark, for the browser bar. */
  colors: { light: string; dark: string }
}

export type SharedProps = {
  /** theme_editor: whether SIZZLE_THEME_EDITOR turns on the theme editor. */
  app: { claude_configured: boolean; version: string; theme_editor: boolean }
  appearance: Appearance
  /** CSS for custom themes (see Theme.custom_stylesheet). */
  theme_css: string
  preferences: BrowserPreferences
  /** Failed imports that haven't been dismissed. */
  failed_import_count: number
  /** Newest release notes bundled with this version, never a remote update check. */
  latest_release: string | null
}

export type Release = {
  version: string
  date: string
  title: string
  summary: string
  url: string
  highlights: { title: string; body: string }[]
  sections: { title: string; paragraphs: string[] }[]
}

export type RecipeSort = 'newest' | 'alphabetical' | 'recently_cooked' | 'never_cooked'

export type BrowserPreferences = {
  text_size: 'standard' | 'large'
  keep_awake: 'off' | 'on'
  sort: RecipeSort
  ai_mode: 'ask' | 'automatic'
}

export type ThemeToken =
  | 'porcelain'
  | 'paper'
  | 'ink'
  | 'graphite'
  | 'hairline'
  | 'action'
  | 'on-action'
  | 'active'
  | 'on-active'
  | 'mark'
  | 'accent'
  | 'danger'
  | 'on-danger'

export type ThemeColors = Record<ThemeToken, string>

export type ThemeOption = {
  id: string
  name: string
  description: string
  light: ThemeColors
  dark: ThemeColors
  /** Set for themes made in the editor; built-in themes can't be edited. */
  custom_id: number | null
}

/** What the theme editor edits: a saved custom theme (id set) or a new one. */
export type ThemeDraft = {
  id: number | null
  name: string
  description: string
  light: ThemeColors
  dark: ThemeColors
}

export type MealTime = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export type ManualRecipeInput = {
  title: string
  description: string
  ingredients: string
  steps: string
  servings: string
  prep_minutes: string
  cook_minutes: string
  source_url: string
  meal_times: MealTime[]
  seasons: Season[]
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

export type SourceMetadata = {
  title?: string
  site_name?: string
  description?: string
}

export type RecipeDetail = RecipeCard & {
  description: string | null
  author: string | null
  source_url: string | null
  source_name: string | null
  source_metadata: SourceMetadata
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
  meal_times: MealTime[]
  seasons: Season[]
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
  source_metadata: SourceMetadata
  url: string | null
  text_preview: string | null
  status: ImportStatus
  ai_allowed: boolean
  error: string | null
  /** A dismissed failure no longer counts in the header. */
  dismissed: boolean
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
  meal_times: FacetCount[]
  seasons: Season[]
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
  meal?: string
  season?: string
}

export type CookbookImportStatus = {
  status: 'queued' | 'running' | 'done' | 'failed'
  in_progress: boolean
  /** Queued or running, but no progress for an hour: the worker likely stopped. */
  stalled: boolean
  imported_count: number
  skipped_count: number
  rejected_count: number
  error: string | null
  finished_at: string | null
}

/** Settings → Your data. enabled mirrors SIZZLE_COOKBOOK_IMPORT. */
export type CookbookImportSettings = {
  enabled: boolean
  max_mib: number
  latest: CookbookImportStatus | null
}
