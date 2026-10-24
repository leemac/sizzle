require "test_helper"

class StructuredImportPipelineTest < ActiveSupport::TestCase
  include ActiveJob::TestHelper

  URL = "https://samskitchen.example.com/chickpea-curry".freeze

  setup do
    @original_key = ENV.delete("ANTHROPIC_API_KEY")
    stub_request(:get, URL).to_return(body: file_fixture_html("recipe_page.html"), headers: { "Content-Type" => "text/html" })
    stub_request(:get, "https://cdn.example.com/curry-1200x900.jpg").to_return(body: sample_jpeg, headers: { "Content-Type" => "image/jpeg" })
  end

  teardown do
    @original_key ? ENV["ANTHROPIC_API_KEY"] = @original_key : ENV.delete("ANTHROPIC_API_KEY")
  end

  def run_import(input, **options)
    import = Import.from_input(input, origin: "web")
    perform_enqueued_jobs(only: []) { import.save! }
    ImportPipeline.new(import, http: safe_http, **options).run
    import.reload
  end

  test "imports structured recipes without an API key and preserves images and source" do
    import = run_import(URL)

    assert_equal "done", import.status
    assert_equal "Weeknight Chickpea Curry", import.recipe.title
    assert_equal URL, import.recipe.source_url
    assert_equal "1 1/2 cups chickpeas, drained", import.recipe.ingredients.sole["item"]
    assert import.recipe.cover.attached?
    assert_equal "image/webp", import.recipe.cover.content_type
  end

  test "prefers usable structured data even when an AI extractor is available" do
    extractor = FakeExtractor.new
    import = run_import(URL, extractor:)

    assert_equal "done", import.status
    assert_empty extractor.pages
    assert_equal import.recipe, run_import("#{URL}?utm_source=share").recipe
    assert_equal 1, Recipe.count
  end

  test "provides a manual recovery path when a page lacks usable structured data" do
    stub_request(:get, URL).to_return(body: "<h1>Curry</h1><p>Simmer chickpeas.</p>", headers: { "Content-Type" => "text/html" })
    import = run_import(URL)

    assert_equal "failed", import.status
    assert_includes import.error, "Write the recipe manually"
    assert_includes import.error, "optional AI"
    assert_equal 0, Recipe.count
  end

  test "unstructured pasted text without AI fails clearly without creating a recipe" do
    import = run_import("Curry: chickpeas, simmer.")

    assert_equal "failed", import.status
    assert_includes import.error, "Write the recipe manually"
    assert_nil import.recipe
  end

  test "structured image URLs still pass through SafeHttp" do
    html = file_fixture_html("recipe_page.html").sub("https://cdn.example.com/curry-1200x900.jpg", "http://169.254.169.254/private.jpg")
    stub_request(:get, URL).to_return(body: html, headers: { "Content-Type" => "text/html" })
    stub_request(:get, "https://cdn.example.com/curry-hero.jpg").to_return(status: 404)
    stub_request(:get, "https://cdn.example.com/step-onions-800x600.jpg").to_return(status: 404)
    import = run_import(URL, http: safe_http("169.254.169.254" => "169.254.169.254"))

    assert_equal "done", import.status
    assert_not import.recipe.cover.attached?
    assert_not_requested :get, "http://169.254.169.254/private.jpg"
  end

  test "private pages remain blocked before structured extraction" do
    import = run_import("http://router.example/", http: safe_http("router.example" => "192.168.1.1"))

    assert_equal "failed", import.status
    assert_includes import.error, "can't be fetched"
    assert_not_requested :get, "http://router.example/"
  end
end
