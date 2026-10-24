# Marks imports failed when their worker died mid-job (see Import.reconcile_failed_jobs!),
# so they show "Try again" instead of spinning forever. Scheduled in config/recurring.yml.
class ReconcileImportsJob < ApplicationJob
  queue_as :default

  def perform
    Import.reconcile_failed_jobs!
  end
end
