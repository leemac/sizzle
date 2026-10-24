class FavoritesController < InertiaController
  def create
    recipe.favorite!
    redirect_back_or_to recipe_path(recipe)
  end

  def destroy
    recipe.unfavorite!
    redirect_back_or_to recipe_path(recipe)
  end

  private

  def recipe
    @recipe ||= Recipe.find(params[:recipe_id])
  end
end
