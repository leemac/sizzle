module ImportSerializer
  extend self

  def call(import)
    {
      id: import.id,
      kind: import.kind,
      origin: import.origin,
      url: import.url,
      text_preview: import.text&.truncate(140),
      status: import.status,
      error: import.error,
      recipe_id: import.recipe_id,
      recipe_title: import.recipe&.title,
      recipe_image_url: import.recipe && RecipeSerializer.cover_image_url(import.recipe),
      created_at: import.created_at.iso8601
    }
  end
end
