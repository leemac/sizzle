class ImportsController < InertiaController
  rate_limit to: 30, within: 1.minute, only: %i[create retry]

  def index
    Import.reconcile_failed_jobs!
    render inertia: "imports/index", props: {
      imports: Import.includes(:recipe).recent.limit(30).map { |import| ImportSerializer.call(import) }
    }
  end

  def create
    import = Import.from_input(params[:input], origin: "web")

    if import.save
      redirect_to imports_path, notice: "Importing… this usually takes under a minute."
    else
      redirect_to imports_path, inertia: { errors: { input: import.errors.full_messages.to_sentence } }
    end
  end

  def retry
    Import.find(params[:id]).retry!
    redirect_to imports_path, notice: "Retrying."
  end
end
