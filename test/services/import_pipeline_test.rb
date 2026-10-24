require "test_helper"

class ImportPipelineTest < ActiveSupport::TestCase
  include ActiveJob::TestHelper

  URL = "https://samskitchen.example.com/chickpea-curry".freeze

  setup do
    @unstructured_page = file_fixture_html("recipe_page.html").sub('"recipeIngredient":', '"unusedIngredients":')
    stub_request(:get, URL).to_return(body: @unstructured_page, headers: { "Content-Type" => "text/html" })
    stub_request(:get, "https://cdn.example.com/curry-1200x900.jpg").to_return(body: sample_jpeg, headers: { "Content-Type" => "image/jpeg" })
    @extractor = FakeExtractor.new
  end

  def run_import(import, extractor: @extractor)
    ImportPipeline.new(import, http: safe_http, extractor:).run
  end

  def url_import(url = URL)
    perform_enqueued_jobs(only: []) { Import.create!(kind: "url", url:, origin: "share") }
  end

  test "imports a URL into a clean recipe with a WebP cover" do
    import = url_import
    recipe = run_import(import)

    assert_equal "done", import.reload.status
    assert_equal recipe, import.recipe
    assert_equal "Weeknight Chickpea Curry", recipe.title
    assert_equal URL, recipe.source_url
    assert_equal "samskitchen.example.com", recipe.source_host
    assert_equal "Sam's Kitchen", recipe.source_name
    assert_equal [ "vegan" ], recipe.diets, "unknown diets are dropped"
    assert_equal "chickpeas", recipe.main_ingredient
    assert_equal %w[weeknight one-pot], recipe.tags
    assert recipe.cover.attached?
    assert_equal "image/webp", recipe.cover.content_type
  end

  test "passes the scraped page to the extractor" do
    run_import(url_import)
    page = @extractor.pages.sole

    assert_equal "Weeknight Chickpea Curry", page.structured_recipe["name"]
    assert_nil page.structured_recipe["recipeIngredient"]
    assert_equal "Weeknight Chickpea Curry", page.title
    assert_equal "img1", page.images.first.id
  end

  test "reuses an existing recipe instead of importing the same page twice" do
    first = run_import(url_import)
    second = run_import(url_import("#{URL}?utm_source=instagram"))

    assert_equal first, second
    assert_equal 1, Recipe.count
    assert_equal 1, @extractor.pages.size, "Claude is only called once"
  end

  test "a concurrent import of the same canonical source waits before calling Claude" do
    first = url_import
    second = url_import("#{URL}?utm_source=share")
    stub_request(:get, "#{URL}?utm_source=share").to_return(
      body: @unstructured_page, headers: { "Content-Type" => "text/html" }
    )
    inner_extractor = FakeExtractor.new
    outer_extractor = FakeExtractor.new
    # Enter a second worker precisely after the first has claimed its canonical
    # source but before its paid extraction finishes (no scheduler timing race).
    test_case = self
    outer_extractor.define_singleton_method(:from_page) do |page|
      test_case.assert_raises(ImportSourceLock::Busy) do
        ImportPipeline.new(second, http: test_case.safe_http,
                           extractor: inner_extractor).run
      end
      super(page)
    end
    recipe = run_import(first, extractor: outer_extractor)
    assert_empty inner_extractor.pages
    assert_equal recipe, run_import(second, extractor: inner_extractor)
    assert_equal 1, Recipe.count
    assert_empty inner_extractor.pages
  end

  test "source claims are released when extraction raises" do
    import = url_import
    extractor = Object.new
    extractor.define_singleton_method(:from_page) { |_page| raise RecipeExtractor::Retryable, "busy" }
    assert_raises(RecipeExtractor::Retryable) { run_import(import, extractor:) }
    assert run_import(import)
    assert_equal "done", import.reload.status
  end

  test "the database rejects duplicate normalized recipe URLs" do
    Recipe.create!(title: "Pie", source_url: URL)
    assert_raises(ActiveRecord::RecordNotUnique) do
      Recipe.create!(title: "Duplicate", source_url: "#{URL}?utm_source=share")
    end
  end

  test "fails cleanly when the page isn't a recipe" do
    import = url_import
    run_import(import, extractor: FakeExtractor.new(FakeExtractor.recipe("is_recipe" => false)))

    assert_equal "failed", import.reload.status
    assert_match "doesn't look like a recipe", import.error
    assert_equal 0, Recipe.count
  end

  test "a blocked site suggests manual entry without calling Claude" do
    stub_request(:get, URL).to_return(status: 403, body: "upstream challenge markup")
    import = url_import

    run_import(import)

    assert_equal "failed", import.reload.status
    assert_match "This site blocked Sizzle's request (HTTP 403)", import.error
    assert_match "then add it with Write a recipe", import.error
    assert_not_includes import.error, "upstream challenge markup"
    assert_empty @extractor.pages
    assert_equal 0, Recipe.count
  end

  test "other HTTP failures keep their status in the error" do
    stub_request(:get, URL).to_return(status: 404)
    import = url_import

    run_import(import)

    assert_equal "failed", import.reload.status
    assert_equal "Couldn't load that page (HTTP 404).", import.error
    assert_empty @extractor.pages
  end

  test "fails cleanly when the URL points into a private network" do
    import = perform_enqueued_jobs(only: []) { Import.create!(kind: "url", url: "http://router.example/", origin: "web") }
    ImportPipeline.new(import, http: safe_http("router.example" => "192.168.1.1"), extractor: @extractor).run

    assert_equal "failed", import.reload.status
    assert_match "can't be fetched", import.error
    assert_empty @extractor.pages
  end

  test "imports pasted text" do
    import = perform_enqueued_jobs(only: []) { Import.create!(kind: "text", text: "Curry: chickpeas, simmer.", origin: "web") }
    recipe = run_import(import)

    assert_equal "Weeknight Chickpea Curry", recipe.title
    assert_equal [ "Curry: chickpeas, simmer." ], @extractor.texts
    assert_not recipe.cover.attached?
  end

  test "a missing or broken image doesn't fail the import" do
    stub_request(:get, "https://cdn.example.com/curry-1200x900.jpg").to_return(status: 404)
    stub_request(:get, "https://cdn.example.com/curry-hero.jpg").to_return(body: "not an image", headers: { "Content-Type" => "image/jpeg" })
    stub_request(:get, "https://cdn.example.com/step-onions-800x600.jpg").to_return(body: sample_jpeg(width: 200, height: 150), headers: { "Content-Type" => "image/jpeg" })

    recipe = run_import(url_import)

    assert_equal "Weeknight Chickpea Curry", recipe.title
    assert_not recipe.cover.attached?
  end

  test "a page can't claim another site's recipe through its canonical link" do
    existing = Recipe.create!(title: "The real curry", source_url: URL)
    impostor = "https://impostor.example/curry"
    stub_request(:get, impostor).to_return(body: %(<link rel="canonical" href="#{URL}"><p>Curry</p>),
                                           headers: { "Content-Type" => "text/html" })

    recipe = run_import(url_import(impostor))

    assert_not_equal existing, recipe
    assert_equal impostor, recipe.source_url
    assert_equal "The real curry", existing.reload.title
  end
end
