class ImportsController < InertiaController
  rate_limit to: 30, within: 1.minute, only: %i[create retry]

  def index
    Import.reconcile_failed_jobs!
    render inertia: "imports/index", props: {
      imports: Import.includes(:recipe).recent.limit(30).map { |import| ImportSerializer.call(import) }
    }
  end

  def create
    url_input = params.key?(:url)
    import = if url_input
      Import.new(kind: "url", url: params[:url].to_s.strip, origin: "web")
    else
      Import.from_input(params[:input], origin: "web")
    end
    destination = url_input ? root_path : imports_path

    if import.save
      redirect_to destination, notice: "Importing… this usually takes under a minute."
    else
      field = url_input ? :url : :input
      redirect_to destination, inertia: { errors: { field => import.errors.full_messages.to_sentence } }
    end
  end

  def retry
    Import.find(params[:id]).retry!
    redirect_to imports_path, notice: "Retrying."
  end
end
