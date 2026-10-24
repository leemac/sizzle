class ImportJob < ApplicationJob
  queue_as :default

  # Another import owns this source. Release the worker and retry after it saves.
  retry_on ImportSourceLock::Busy, wait: 5.seconds, attempts: :unlimited

  # Transient Claude failures (rate limits, overload) back off and retry; after
  # the last attempt the import is marked failed so the user can retry by hand.
  retry_on RecipeExtractor::Retryable, wait: :polynomially_longer, attempts: 4 do |job, error|
    job.arguments.first.fail!(error.message)
  end

  discard_on ActiveJob::DeserializationError

  def perform(import)
    return unless import.pending?

    ImportPipeline.new(import).run
  rescue RecipeExtractor::Retryable, ImportSourceLock::Busy
    raise
  rescue StandardError => e
    import.fail!("Something went wrong while importing.")
    raise e
  end
end
