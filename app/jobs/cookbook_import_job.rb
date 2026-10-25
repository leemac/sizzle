class CookbookImportJob < ApplicationJob
  queue_as :default

  discard_on ActiveJob::DeserializationError

  def perform(cookbook_import)
    return unless cookbook_import.status == "queued"

    CookbookImporter.new(cookbook_import).run
  end
end
