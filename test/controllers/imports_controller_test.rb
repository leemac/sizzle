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
    assert_empty inertia.props[:failed_imports]
    assert_equal "Weeknight Chickpea Curry", inertia.props[:recipes].sole[:title]
    assert inertia.props[:recipes].sole[:image_url]
    get imports_url
    assert_equal RecipeSerializer.cover_image_url(import.recipe), inertia.props[:imports].sole[:recipe_image_url]
    assert_match %r{\A/rails/active_storage/representations/proxy/}, inertia.props[:imports].sole[:recipe_image_url]
  ensure
    original_key ? ENV["ANTHROPIC_API_KEY"] = original_key : ENV.delete("ANTHROPIC_API_KEY")
  end

  test "gallery shows background failures including blocked private network fetches" do
    post imports_url, params: { input: "http://router.example/pie" }
    import = Import.last
    extractor = FakeExtractor.new
    ImportPipeline.new(import, http: safe_http("router.example" => "192.168.1.1"), extractor:).run
    get root_url

    assert_empty extractor.pages
    assert_empty inertia.props[:pending_imports]
    failure = inertia.props[:failed_imports].sole
    assert_equal import.id, failure[:id]
    assert_match "non-public address", failure[:error]
  end

  test "gallery limits failed imports to the three most recent" do
    4.times do |index|
      Import.create!(kind: "url", url: "https://example.com/#{index}", origin: "web").fail!("Could not import")
    end

    get root_url

    assert_equal Import.recent.limit(3).pluck(:id), inertia.props[:failed_imports].map { |item| item[:id] }
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
end
