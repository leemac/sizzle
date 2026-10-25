# Shapes Recipe records into Inertia props. Keep these in sync with
# app/frontend/types/index.ts.
module RecipeSerializer
  extend self

  def card(recipe)
    {
      id: recipe.id,
      title: recipe.title,
      cuisine: recipe.cuisine,
      course: recipe.course,
      total_minutes: recipe.total_minutes,
      source_host: recipe.source_host,
      favorite: recipe.favorite?,
      image_url: cover_image_url(recipe)
    }
  end

  def menu(recipe)
    keys = {
      uid: recipe.uid,
      url: RecipeSignature.url_key(recipe.source_url),
      content: RecipeSignature.fingerprint(recipe.title, recipe.ingredients)
    }.filter_map { |kind, value| "#{kind}:#{value}" if value.present? }

    card(recipe).merge(
      description: recipe.description&.truncate(240),
      meal_times: recipe.meal_times,
      cooks_count: recipe.cooks_count,
      signature_keys: keys
    )
  end

  def cover_image_url(recipe)
    image_path(recipe.cover, :card)
  end

  def source_duplicate(recipe)
    { id: recipe.id, title: recipe.title, archived: recipe.archived? }
  end

  def detail(recipe)
    video_id = YoutubeVideo.id_from_url(recipe.source_url)
    video = video_id && recipe.video_metadata["id"] == video_id ? recipe.video_metadata : {}

    card(recipe).merge(
      description: recipe.description,
      author: recipe.author,
      source_url: recipe.source_url,
      source_name: recipe.source_name,
      source_metadata: recipe.source_metadata,
      youtube_url: video_id && YoutubeVideo.watch_url(video_id),
      youtube_duration_seconds: video["duration_seconds"],
      youtube_chapters: Array(video["chapters"]).map do |chapter|
        chapter.merge("url" => "#{YoutubeVideo.watch_url(video_id)}&t=#{chapter.fetch('start_seconds')}s")
      end,
      written_recipe_url: video["written_recipe_url"],
      servings: recipe.servings,
      yield_text: recipe.yield_text,
      prep_minutes: recipe.prep_minutes,
      cook_minutes: recipe.cook_minutes,
      main_ingredient: recipe.main_ingredient,
      diets: recipe.diets,
      meal_times: recipe.meal_times,
      seasons: recipe.seasons,
      tags: recipe.tags,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      tips: recipe.tips,
      notes: recipe.notes,
      rating: recipe.rating,
      hero_url: image_path(recipe.cover, :hero),
      photo_urls: recipe.photos.map { |photo| routes.rails_storage_proxy_path(photo.variant(:medium), only_path: true) },
      created_at: recipe.created_at.iso8601,
      edited_at: recipe.edited_at&.iso8601,
      cooks_count: recipe.cooks_count,
      last_cook: last_cook(recipe),
      archived: recipe.archived?
    )
  end

  # The edit form's starting values, as the strings the form fields hold.
  def edit(recipe, form)
    {
      id: recipe.id,
      title: recipe.title,
      fields: RecipeEdit::FIELDS.index_with { |field| form.public_send(field).to_s }
        .merge(RecipeEdit::LIST_FIELDS.keys.index_with { |field| form.public_send(field) }),
      courses: Recipe::COURSES
    }
  end

  private

  def last_cook(recipe)
    cook = recipe.last_cook
    cook && { id: cook.id, cooked_at: cook.cooked_at.iso8601 }
  end

  def image_path(attachment, variant)
    return unless attachment.attached?

    routes.rails_storage_proxy_path(attachment.variant(variant), only_path: true)
  end

  def routes
    Rails.application.routes.url_helpers
  end
end
