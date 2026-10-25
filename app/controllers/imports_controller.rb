class ImportsController < InertiaController
  IMPORTS_PER_MINUTE = ImportBudget::LIMIT

  rate_limit to: 30, within: 1.minute, only: %i[create retry]

  def index
    render_index
  end

  def create
    return create_manual_recipe if params.key?(:manual_recipe)

    batch = ImportBatch.new(params[:input], origin: "web")
    batch.imports.each { |import| import.ai_allowed = ai_allowed? }
    unless batch.valid?
      return redirect_to imports_path, inertia: { errors: { input: batch.errors.full_messages.to_sentence } }
    end

    review = ImportReview.new(batch)
    if (review.needed? || params[:review_token].present?) && params[:review_token] != review.token
      return render_index(review:)
    end

    selected = params.permit(selected_urls: [])[:selected_urls] || [] if params[:review_token].present?
    count = review.imports(selected).size
    if count.positive? && !ImportBudget.charge(count, store: cache_store)
      redirect_to imports_path, inertia: { errors: { input: "That would be more than #{IMPORTS_PER_MINUTE} imports in a minute. Wait a minute, or paste fewer links." } }
    else
      restored = review.save(selected)
      flash[:submitted_import_ids] = review.imports(selected).map(&:id)
      notice = if restored.positive?
        "Restored #{restored} archived #{'recipe'.pluralize(restored)} to your cookbook."
      elsif count.zero?
        "Done. No new imports were needed."
      end
      redirect_to imports_path, notice:
    end
  end

  def retry
    import = Import.find(params[:id])
    if import.status == "failed" && !ImportBudget.charge(1, store: cache_store)
      return redirect_to imports_path, alert: "Too many imports. Wait a minute before retrying."
    end
    import.retry!(ai_allowed: ai_allowed?)
    redirect_to imports_path, notice: "Retrying."
  end

  def dismiss
    Import.find(params[:id]).dismiss!
    redirect_to imports_path
  end

  private

  def ai_allowed?
    # Capture what the submitting page allowed. A changed cookie in another tab
    # must not turn an unchecked, local-only submission into a Claude request.
    explicit = params[:allow_ai].in?([ true, "true", "1" ])
    automatic = params[:automatic_ai].in?([ true, "true", "1" ]) && browser_preferences.ai_mode == "automatic"
    explicit || automatic
  end

  def render_index(review: nil)
    inertia_meta.add(title: "Add a recipe")
    render inertia: "imports/index", props: {
      imports: recent_imports.map { |import| ImportSerializer.call(import) },
      mode: params[:mode] == "manual" ? "manual" : "import",
      duplicate_review: review && ImportReviewSerializer.call(review),
      submitted_import_ids: Array(flash[:submitted_import_ids]),
      source_duplicate: -> {
        recipe = Recipe.find_by(id: flash[:duplicate_recipe_id])
        RecipeSerializer.source_duplicate(recipe) if recipe
      },
      source_url: -> { Import.find_by(id: params[:from], kind: "url")&.url if params[:from].present? }
    }
  end

  # The latest imports, plus older ones that still need attention, are running
  # again after a retry, or just finished one. The header's failure count always
  # leads somewhere, and a retried import keeps showing until you see its result.
  def recent_imports
    scope = Import.includes(recipe: { cover_attachment: :blob }).recent
    imports = scope.limit(30).to_a + scope.needs_attention.limit(30).to_a + scope.pending.limit(30).to_a +
      scope.where(finished_at: 1.hour.ago..).reorder(finished_at: :desc).limit(30).to_a
    current = scope.find_by(id: params[:current]) if params[:current].present?
    [ current, *imports ].compact.uniq
  end

  def create_manual_recipe
    form = ManualRecipe.new(params.expect(manual_recipe: ManualRecipe.permitted_fields))
    if form.save
      redirect_to recipe_path(form.recipe), notice: "Recipe saved."
    else
      flash[:duplicate_recipe_id] = form.duplicate_recipe.id if form.duplicate_recipe
      redirect_to imports_path(mode: "manual"), inertia: { errors: form.errors.to_hash.transform_values(&:to_sentence) }
    end
  end
end
