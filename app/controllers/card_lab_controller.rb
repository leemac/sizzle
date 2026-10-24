# Temporary: compares gallery card designs side by side with real recipes.
# Routed in development only. Delete this, its route, its test and
# app/frontend/pages/lab/ once a design is picked.
class CardLabController < InertiaController
  def show
    render inertia: "lab/cards", props: {
      recipes: varied_sample.map do |recipe|
        RecipeSerializer.card(recipe).merge(
          description: recipe.description,
          servings: recipe.servings,
          main_ingredient: recipe.main_ingredient,
          diets: recipe.diets
        )
      end
    }
  end

  private

  # Interleaves courses so the first few cards aren't all drinks.
  def varied_sample
    groups = Recipe.active.with_attached_cover.order(:id).limit(96).group_by(&:course).values
    longest = groups.map(&:size).max.to_i
    groups.map { |group| group + Array.new(longest - group.size) }.transpose.flatten.compact.first(24)
  end
end
