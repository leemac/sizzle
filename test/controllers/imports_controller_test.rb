require "test_helper"

class ImportsControllerTest < ActionDispatch::IntegrationTest
  include ActiveJob::TestHelper

  test "URL imports are trimmed, enqueued and shown as pending on the gallery" do
    assert_enqueued_with(job: ImportJob) do
      post imports_url, params: { input: "  https://example.com/pie  " }
    end

    assert_redirected_to imports_url
    import = Import.last
    assert_equal "url", import.kind
    assert_equal "web", import.origin
    assert_equal "https://example.com/pie", import.url
    get root_url
    assert_equal [ import.id ], inertia.props[:pending_imports].map { |item| item[:id] }
  end

  test "several links import as one recipe each" do
    assert_enqueued_jobs 2, only: ImportJob do
      post imports_url, params: { input: "https://example.com/pie\nhttps://example.com/cake" }
    end

    assert_redirected_to imports_url
    assert_nil flash[:notice], "inline progress replaces the generic success banner"
    assert_equal Import.order(:id).last(2).map(&:id), flash[:submitted_import_ids]
    assert_equal %w[https://example.com/pie https://example.com/cake], Import.order(:id).pluck(:url).last(2)
    follow_redirect!
    assert_equal Import.order(:id).last(2).map(&:id), inertia.props[:submitted_import_ids]
  end

  test "invalid links return field errors without creating or enqueueing imports" do
    [ "", "https://user:password@example.com/pie", "https://example.com:6379/pie",
      "https://example.com/#{'a' * 2048}", "https://example.com/ok\nhttps://example.com:6379/pie",
      Array.new(ImportBatch::MAX_LINKS + 1) { |index| "https://example.com/#{index}" }.join("\n") ].each do |input|
      assert_no_enqueued_jobs do
        assert_no_difference("Import.count") { post imports_url, params: { input: } }
      end
      assert_redirected_to imports_url
      follow_redirect!
      assert inertia.props[:errors][:input].present?, "expected an input error for #{input.truncate(40)}"
    end
  end

  test "every link counts against the per-minute import budget" do
    previous = ImportsController.cache_store
    ImportsController.cache_store = ActiveSupport::Cache::MemoryStore.new
    links = ->(prefix, count) { Array.new(count) { |index| "https://example.com/#{prefix}#{index}" }.join("\n") }

    assert_difference("Import.count", 20) { post imports_url, params: { input: links.("a", 20) } }

    # 20 more would go over 30: nothing is queued, and the batch doesn't use up the budget.
    assert_no_enqueued_jobs do
      assert_no_difference("Import.count") { post imports_url, params: { input: links.("b", 20) } }
    end
    follow_redirect!
    assert_match "more than 30 imports in a minute", inertia.props[:errors][:input]

    assert_difference("Import.count", 10) { post imports_url, params: { input: links.("c", 10) } }
    assert_no_difference("Import.count") { post imports_url, params: { input: "https://example.com/one-more" } }

    travel 61.seconds do
      assert_difference("Import.count", 1) { post imports_url, params: { input: "https://example.com/next-minute" } }
    end
  ensure
    ImportsController.cache_store = previous
  end

  test "gallery import uses structured recipe data without AI and appears as a recipe" do
    original_key = ENV.delete("ANTHROPIC_API_KEY")
    url = "https://samskitchen.example.com/chickpea-curry"
    stub_request(:get, url).to_return(body: file_fixture_html("recipe_page.html"), headers: { "Content-Type" => "text/html" })
    stub_request(:get, "https://cdn.example.com/curry-1200x900.jpg").to_return(body: sample_jpeg, headers: { "Content-Type" => "image/jpeg" })

    post imports_url, params: { input: url }
    import = Import.last
    ImportPipeline.new(import, http: safe_http).run
    get root_url

    assert_equal "done", import.reload.status
    assert_empty inertia.props[:pending_imports]
    assert_equal 0, inertia.props[:failed_import_count]
    assert_equal "Weeknight Chickpea Curry", inertia.props[:recipes].sole[:title]
    assert inertia.props[:recipes].sole[:image_url]
    get imports_url
    assert_equal RecipeSerializer.cover_image_url(import.recipe), inertia.props[:imports].sole[:recipe_image_url]
    assert_match %r{\A/rails/active_storage/representations/proxy/}, inertia.props[:imports].sole[:recipe_image_url]
  ensure
    original_key ? ENV["ANTHROPIC_API_KEY"] = original_key : ENV.delete("ANTHROPIC_API_KEY")
  end

  test "the header counts background failures including blocked private network fetches" do
    post imports_url, params: { input: "http://router.example/pie" }
    import = Import.last
    extractor = FakeExtractor.new
    ImportPipeline.new(import, http: safe_http("router.example" => "192.168.1.1"), extractor:).run
    get root_url

    assert_empty extractor.pages
    assert_empty inertia.props[:pending_imports]
    assert_equal 1, inertia.props[:failed_import_count]
    get imports_url
    failure = inertia.props[:imports].find { |item| item[:id] == import.id }
    assert_match "non-public address", failure[:error]
    assert_not failure[:dismissed]
  end

  test "dismissing a failure clears it from the header count but keeps it in history" do
    failed = Import.create!(kind: "url", url: "https://example.com/failed", origin: "web")
    failed.fail!("Could not import")
    get root_url
    assert_equal 1, inertia.props[:failed_import_count]

    post dismiss_import_url(failed)

    assert_redirected_to imports_url
    follow_redirect!
    assert_equal 0, inertia.props[:failed_import_count]
    assert inertia.props[:imports].find { |item| item[:id] == failed.id }[:dismissed]
    assert_equal "failed", failed.reload.status
  end

  test "only failures can be dismissed" do
    pending = Import.create!(kind: "url", url: "https://example.com/pending", origin: "web")
    done = Import.create!(kind: "url", url: "https://example.com/done", origin: "web")
    done.succeed!(Recipe.create!(title: "Pie"))

    [ pending, done ].each { |import| post dismiss_import_url(import) }

    assert_nil pending.reload.dismissed_at
    assert_nil done.reload.dismissed_at
  end

  test "dismissing needs a POST with the browser's CSRF token" do
    failed = Import.create!(kind: "url", url: "https://example.com/failed", origin: "web")
    failed.fail!("Could not import")
    previous = ActionController::Base.allow_forgery_protection
    ActionController::Base.allow_forgery_protection = true

    post dismiss_import_url(failed)

    assert_response :unprocessable_content
    assert_nil failed.reload.dismissed_at
    assert_raises(ActionController::RoutingError) { Rails.application.routes.recognize_path(dismiss_import_path(failed), method: :get) }
  ensure
    ActionController::Base.allow_forgery_protection = previous
  end

  test "retrying a dismissed failure lets a new failure ask for attention again" do
    failed = Import.create!(kind: "url", url: "https://example.com/failed", origin: "web")
    failed.fail!("Could not import")
    failed.dismiss!

    post retry_import_url(failed)
    failed.reload.fail!("Still could not import")

    assert_equal [ failed ], Import.needs_attention.to_a
  end

  test "an old failure stays on the imports page after a retry saves it" do
    old = Import.create!(kind: "url", url: "https://example.com/old", origin: "web", created_at: 2.days.ago)
    old.fail!("Could not import")
    30.times { |index| Import.create!(kind: "url", url: "https://example.com/#{index}", origin: "web").succeed!(Recipe.create!(title: "Recipe #{index}")) }

    post retry_import_url(old)
    get imports_url
    assert_includes inertia.props[:imports].map { |item| item[:id] }, old.id, "still shown while it runs"

    old.reload.succeed!(Recipe.create!(title: "Old pie"))
    get imports_url
    saved = inertia.props[:imports].find { |item| item[:id] == old.id }
    assert_equal "done", saved[:status]
    assert_equal "Old pie", saved[:recipe_title]
  end

  test "the imports page lists failures older than the latest thirty" do
    old = Import.create!(kind: "url", url: "https://example.com/old", origin: "web", created_at: 2.days.ago)
    old.fail!("Could not import")
    30.times { |index| Import.create!(kind: "url", url: "https://example.com/#{index}", origin: "web").succeed!(Recipe.create!(title: "Recipe #{index}")) }

    get imports_url

    assert_includes inertia.props[:imports].map { |item| item[:id] }, old.id
  end

  test "URL imports keep browser CSRF protection" do
    previous = ActionController::Base.allow_forgery_protection
    ActionController::Base.allow_forgery_protection = true

    assert_no_enqueued_jobs do
      assert_no_difference("Import.count") { post imports_url, params: { input: "https://example.com/pie" } }
    end
    assert_response :unprocessable_content
  ensure
    ActionController::Base.allow_forgery_protection = previous
  end

  test "web imports capture explicit permission and default to local extraction" do
    post imports_url, params: { input: "https://example.com/local" }
    assert_not Import.last.ai_allowed?
    post imports_url, params: { input: "https://example.com/approved", allow_ai: true }
    assert Import.last.ai_allowed?
    post imports_url, params: { input: "https://example.com/forged", allow_ai: "anything" }
    assert_not Import.last.ai_allowed?
    patch settings_url, params: { preferences: { ai_mode: "automatic" } }
    post imports_url, params: { input: "https://example.com/automatic" }
    assert_not Import.last.ai_allowed?, "a cookie change cannot authorize a stale page's local-only submission"
    post imports_url, params: { input: "https://example.com/automatic-approved", allow_ai: true }
    assert Import.last.ai_allowed?
    post imports_url, params: { input: "https://example.com/automatic-current", automatic_ai: true }
    assert Import.last.ai_allowed?
    patch settings_url, params: { preferences: { ai_mode: "ask" } }
    post imports_url, params: { input: "https://example.com/stale-automatic", automatic_ai: true }
    assert_not Import.last.ai_allowed?, "turning automatic AI off must also stop stale pages in history or other tabs"
  end

  test "new browser submissions and retries allow automatic AI by default" do
    get imports_url
    assert_equal "automatic", inertia.props[:preferences][:ai_mode]
    post imports_url, params: { input: "https://example.com/default-ai", automatic_ai: true }
    import = Import.last
    assert import.ai_allowed?
    import.fail!("Interrupted")
    post retry_import_url(import), params: { automatic_ai: true }
    assert import.reload.ai_allowed?
  end

  test "permission applies to every link in a batch and is checked again on retries" do
    post imports_url, params: { input: "https://example.com/a\nhttps://example.com/b", allow_ai: true }
    assert Import.last(2).all?(&:ai_allowed?)
    import = Import.last
    import.fail!("No recipe data")
    post retry_import_url(import)
    assert_not import.reload.ai_allowed?
    import.fail!("No recipe data")
    post retry_import_url(import), params: { allow_ai: true }
    assert import.reload.ai_allowed?
  end
end
