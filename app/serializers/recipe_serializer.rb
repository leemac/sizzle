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
      image_url: image_path(recipe.cover, :card)
    }
  end

  def detail(recipe)
    card(recipe).merge(
      description: recipe.description,
      author: recipe.author,
      source_url: recipe.source_url,
      source_name: recipe.source_name,
      servings: recipe.servings,
      yield_text: recipe.yield_text,
      prep_minutes: recipe.prep_minutes,
      cook_minutes: recipe.cook_minutes,
      main_ingredient: recipe.main_ingredient,
      diets: recipe.diets,
      tags: recipe.tags,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      tips: recipe.tips,
      notes: recipe.notes,
      rating: recipe.rating,
      hero_url: image_path(recipe.cover, :hero),
      photo_urls: recipe.photos.map { |photo| routes.rails_storage_proxy_path(photo.variant(:medium), only_path: true) },
      created_at: recipe.created_at.iso8601,
      archived: recipe.archived?
    )
  end

  # The edit form's starting values, as the strings the form fields hold.
  def edit(recipe, form)
    {
      id: recipe.id,
      title: recipe.title,
      fields: RecipeEdit::FIELDS.index_with { |field| form.public_send(field).to_s },
      courses: Recipe::COURSES
    }
  end

  private

  def image_path(attachment, variant)
    return unless attachment.attached?

    routes.rails_storage_proxy_path(attachment.variant(variant), only_path: true)
  end

  def routes
    Rails.application.routes.url_helpers
  end
end
