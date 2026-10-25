# Rails captures the cache store when rate_limit is declared. Swapping the class
# attribute later does not affect that callback. Give its captured NullStore an
# in-memory counter for this test, then restore its original implementation.
module RateLimitStore
  def with_memory_rate_limits(controller)
    store = controller.cache_store
    memory = ActiveSupport::Cache::MemoryStore.new
    store.define_singleton_method(:increment) { |*args, **options| memory.increment(*args, **options) }
    yield
  ensure
    store.singleton_class.remove_method(:increment)
  end
end
