class RecipesController < InertiaController
  PER_PAGE = 48

  def index
    filters = params.permit(*Recipe::Filterable::FILTER_KEYS).to_h
    page = [ params[:page].to_i, 1 ].max
    recipes = Recipe.filter_by(filters).with_attached_cover.offset((page - 1) * PER_PAGE).limit(PER_PAGE + 1).to_a

    render inertia: "recipes/index", props: {
      recipes: recipes.first(PER_PAGE).map { |recipe| RecipeSerializer.card(recipe) },
      page:,
      has_more: recipes.size > PER_PAGE,
      filters:,
      facets: -> { Recipe.facets },
      total_count: -> { Recipe.active.count },
      pending_imports: -> { Import.pending.recent.limit(12).map { |import| ImportSerializer.call(import) } },
      failed_imports: -> { Import.where(status: "failed").recent.limit(3).map { |import| ImportSerializer.call(import) } }
    }
  end

  def show
    recipe = Recipe.with_attached_cover.with_attached_photos.find(params[:id])
    inertia_meta.add(title: recipe.title)
    render inertia: "recipes/show", props: { recipe: RecipeSerializer.detail(recipe) }
  end

  def edit
    recipe = Recipe.find(params[:id])
    inertia_meta.add(title: "Edit #{recipe.title}")
    render inertia: "recipes/edit", props: { recipe: RecipeSerializer.edit(recipe, RecipeEdit.for(recipe)) }
  end

  def update
    recipe = Recipe.find(params[:id])
    form = RecipeEdit.new(recipe, params.expect(recipe: RecipeEdit.permitted_fields))
    if form.save
      redirect_to recipe_path(recipe), notice: "Changes saved."
    else
      redirect_to edit_recipe_path(recipe), inertia: { errors: form.errors.to_hash.transform_values(&:to_sentence) }
    end
  end

  def destroy
    recipe = Recipe.find(params[:id])
    recipe.destroy!
    redirect_to root_path, notice: "Deleted “#{recipe.title}”."
  end
end
