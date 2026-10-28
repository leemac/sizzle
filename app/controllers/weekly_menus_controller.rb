# Local interaction prototype. Menus are stored only in the browser.
class WeeklyMenusController < InertiaController
  def show
    render inertia: "weekly_menus/show", props: {
      recipes: Recipe.active.with_attached_cover.order(:title).map { |recipe| RecipeSerializer.menu(recipe) }
    }
  end
end
