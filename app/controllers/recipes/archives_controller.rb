class Recipes::ArchivesController < InertiaController
  def create
    recipe = Recipe.find(params[:recipe_id])
    recipe.archive!
    redirect_to root_path, notice: "Archived “#{recipe.title}”. It's hidden from your recipes but not deleted."
  end
end
