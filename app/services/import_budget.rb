# One cookbook-wide budget: forwarded headers must never grant more fetches or
# Claude calls. Web batches, the API and retries all charge the same cache key.
class ImportBudget
  LIMIT = 30
  KEY = "import-budget:global".freeze

  def self.charge(count, store: Rails.cache)
    used = store.increment(KEY, count, expires_in: 1.minute)
    return store.is_a?(ActiveSupport::Cache::NullStore) if used.nil?
    return true if used <= LIMIT

    store.decrement(KEY, count)
    false
  end
end
