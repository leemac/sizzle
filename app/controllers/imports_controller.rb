class ImportsController < InertiaController
  rate_limit to: 30, within: 1.minute, only: %i[create retry]

  def index
    render inertia: "imports/index", props: {
      imports: Import.includes(:recipe).recent.limit(30).map { |import| ImportSerializer.call(import) },
      mode: params[:mode] == "manual" ? "manual" : "import",
      source_url: -> { Import.find_by(id: params[:from], kind: "url")&.url if params[:from].present? }
    }
  end

  def create
    return create_manual_recipe if params.key?(:manual_recipe)

    batch = ImportBatch.new(params[:input], origin: "web")
    if batch.save
      count = batch.imports.size
      notice = count == 1 ? "Importing… this usually takes under a minute." : "Importing #{count} recipes… this usually takes a minute or two."
      redirect_to imports_path, notice:
    else
      redirect_to imports_path, inertia: { errors: { input: batch.errors.full_messages.to_sentence } }
    end
  end

  def retry
    Import.find(params[:id]).retry!
    redirect_to imports_path, notice: "Retrying."
  end

  private

  def create_manual_recipe
    form = ManualRecipe.new(params.expect(manual_recipe: %i[title description ingredients steps servings prep_minutes cook_minutes source_url]))
    if form.save
      redirect_to recipe_path(form.recipe), notice: "Recipe saved."
    else
      redirect_to imports_path(mode: "manual"), inertia: { errors: form.errors.to_hash.transform_values(&:to_sentence) }
    end
  end
end
