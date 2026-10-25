class ImportsController < InertiaController
  IMPORTS_PER_MINUTE = 30

  rate_limit to: 30, within: 1.minute, only: %i[create retry]

  def index
    render_index
  end

  def create
    return create_manual_recipe if params.key?(:manual_recipe)

    batch = ImportBatch.new(params[:input], origin: "web")
    unless batch.valid?
      return redirect_to imports_path, inertia: { errors: { input: batch.errors.full_messages.to_sentence } }
    end

    review = ImportReview.new(batch)
    if (review.needed? || params[:review_token].present?) && params[:review_token] != review.token
      return render_index(review:)
    end

    selected = params.permit(selected_urls: [])[:selected_urls] || [] if params[:review_token].present?
    count = review.imports(selected).size
    if count.positive? && !charge_import_budget(count)
      redirect_to imports_path, inertia: { errors: { input: "That would be more than #{IMPORTS_PER_MINUTE} imports in a minute. Wait a minute, or paste fewer links." } }
    else
      restored = review.save(selected)
      notice = case count
      when 0 then "Done. No new imports were needed."
      when 1 then "Importing… this usually takes under a minute."
      else "Importing #{count} recipes… this usually takes a minute or two."
      end
      if restored.positive?
        restored_notice = "Restored #{restored} archived #{'recipe'.pluralize(restored)} to your cookbook."
        notice = count.zero? ? restored_notice : "#{notice} #{restored_notice}"
      end
      redirect_to imports_path, notice:
    end
  end

  def retry
    Import.find(params[:id]).retry!
    redirect_to imports_path, notice: "Retrying."
  end

  private

  def render_index(review: nil)
    inertia_meta.add(title: "Add a recipe")
    render inertia: "imports/index", props: {
      imports: recent_imports.map { |import| ImportSerializer.call(import) },
      mode: params[:mode] == "manual" ? "manual" : "import",
      duplicate_review: review && ImportReviewSerializer.call(review),
      source_duplicate: -> {
        recipe = Recipe.find_by(id: flash[:duplicate_recipe_id])
        RecipeSerializer.source_duplicate(recipe) if recipe
      },
      source_url: -> { Import.find_by(id: params[:from], kind: "url")&.url if params[:from].present? }
    }
  end

  def recent_imports
    imports = Import.includes(:recipe).recent.limit(30).to_a
    current = Import.includes(:recipe).find_by(id: params[:current]) if params[:current].present?
    current ? [ current, *imports ].uniq : imports
  end

  # Every queued import is a fetch and maybe a Claude call, so each link
  # counts against the budget, not just each request. A rejected batch
  # gives its links back.
  def charge_import_budget(count)
    key = "import-budget:#{request.remote_ip}"
    used = cache_store.increment(key, count, expires_in: 1.minute)
    return true if used.nil? || used <= IMPORTS_PER_MINUTE

    cache_store.decrement(key, count)
    false
  end

  def create_manual_recipe
    form = ManualRecipe.new(params.expect(manual_recipe: %i[title description ingredients steps servings prep_minutes cook_minutes source_url]))
    if form.save
      redirect_to recipe_path(form.recipe), notice: "Recipe saved."
    else
      flash[:duplicate_recipe_id] = form.duplicate_recipe.id if form.duplicate_recipe
      redirect_to imports_path(mode: "manual"), inertia: { errors: form.errors.to_hash.transform_values(&:to_sentence) }
    end
  end
end
