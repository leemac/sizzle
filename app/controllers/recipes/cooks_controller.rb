class Recipes::CooksController < InertiaController
  def create
    recipe.cooked!
    redirect_to recipe_path(recipe)
  end

  # Undo: removes one logged time, and only from this recipe.
  def destroy
    recipe.cooks.find(params[:id]).destroy!
    redirect_to recipe_path(recipe)
  end

  private

  def recipe
    @recipe ||= Recipe.find(params[:recipe_id])
  end
end
