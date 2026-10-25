require "test_helper"

class YoutubeImportPipelineTest < ActiveSupport::TestCase
  include ActiveJob::TestHelper

  ID = YoutubeWatchPage::VIDEO_ID
  WATCH_URL = "https://www.youtube.com/watch?v=#{ID}".freeze
  RECIPE_URL = "https://samskitchen.example.com/chickpea-curry".freeze
  MAXRES_URL = "https://i.ytimg.com/vi/#{ID}/maxresdefault.jpg".freeze
  SD_URL = "https://i.ytimg.com/vi/#{ID}/sddefault.jpg".freeze

  setup do
    @original_key = ENV.delete("ANTHROPIC_API_KEY")
    stub_watch_page
    stub_request(:get, MAXRES_URL).to_return(body: sample_jpeg(width: 1280, height: 720), headers: { "Content-Type" => "image/jpeg" })
  end

  teardown do
    @original_key ? ENV["ANTHROPIC_API_KEY"] = @original_key : ENV.delete("ANTHROPIC_API_KEY")
  end

  def stub_watch_page(**options)
    stub_request(:get, WATCH_URL).to_return(body: YoutubeWatchPage.html(**options), headers: { "Content-Type" => "text/html" })
  end

  def run_import(url, **options)
    import = perform_enqueued_jobs(only: []) { Import.create!(kind: "url", url:, origin: "share") }
    ImportPipeline.new(import, http: safe_http, **options).run
    import.reload
  end

  test "imports a recipe from a video description, keeping the video as the source" do
    extractor = FakeExtractor.new
    import = run_import("https://youtu.be/#{ID}?si=share", extractor:)

    assert_equal "done", import.status
    assert_equal WATCH_URL, import.recipe.source_url
    assert_equal "Emma's Goodies", import.recipe.source_name
    assert_includes extractor.pages.sole.text, "- 560g bread flour"
    assert import.recipe.cover.attached?
    assert_equal "image/webp", import.recipe.cover.content_type
  end

  test "every form of a video link finds the same recipe without fetching or extracting again" do
    extractor = FakeExtractor.new
    first = run_import("https://www.youtube.com/watch?v=#{ID}&t=30s", extractor:).recipe
    second = run_import("https://www.youtube.com/shorts/#{ID}", extractor:).recipe

    assert_equal first, second
    assert_equal 1, Recipe.count
    assert_equal 1, extractor.pages.size
    assert_requested :get, WATCH_URL, times: 1
  end

  test "falls back to the smaller thumbnail when the video has no full-size one" do
    stub_request(:get, MAXRES_URL).to_return(status: 404)
    stub_request(:get, SD_URL).to_return(body: sample_jpeg(width: 640, height: 480), headers: { "Content-Type" => "image/jpeg" })
    import = run_import(WATCH_URL, extractor: FakeExtractor.new)

    assert import.recipe.cover.attached?
  end

  test "imports without AI when the description links to a page with recipe data" do
    stub_watch_page(description: "Full recipe: #{RECIPE_URL}")
    stub_request(:get, RECIPE_URL).to_return(body: file_fixture_html("recipe_page.html"), headers: { "Content-Type" => "text/html" })
    stub_request(:get, "https://cdn.example.com/curry-1200x900.jpg").to_return(body: sample_jpeg, headers: { "Content-Type" => "image/jpeg" })
    import = run_import(WATCH_URL)

    assert_equal "done", import.status
    assert_equal "Weeknight Chickpea Curry", import.recipe.title
    assert_equal WATCH_URL, import.recipe.source_url
    assert_equal "Emma's Goodies", import.recipe.source_name
    assert_not_requested :get, MAXRES_URL
  end

  test "without AI or linked recipe data, explains how to save the video's recipe" do
    import = run_import(WATCH_URL)

    assert_equal "failed", import.status
    assert_includes import.error, "This video's description has no recipe data"
    assert_includes import.error, "optional AI"
    assert_equal 0, Recipe.count
  end

  test "explains that spoken-only recipes can't be read" do
    stub_watch_page(description: "Subscribe for more! Shop my kitchen tools: https://shop.example.com")
    import = run_import(WATCH_URL, extractor: FakeExtractor.new(FakeExtractor.recipe("is_recipe" => false)))

    assert_equal "failed", import.status
    assert_includes import.error, "only spoken"
    assert_equal 0, Recipe.count
  end

  test "reports private or removed videos" do
    stub_watch_page(status: "ERROR", details: nil)
    import = run_import(WATCH_URL, extractor: FakeExtractor.new)

    assert_equal "failed", import.status
    assert_includes import.error, "isn't available"
  end

  test "other sites' pages still go through the page scraper" do
    stub_request(:get, RECIPE_URL).to_return(body: file_fixture_html("recipe_page.html"), headers: { "Content-Type" => "text/html" })
    stub_request(:get, "https://cdn.example.com/curry-1200x900.jpg").to_return(body: sample_jpeg, headers: { "Content-Type" => "image/jpeg" })

    assert_equal RECIPE_URL, run_import(RECIPE_URL).recipe.source_url
    assert_not_requested :get, WATCH_URL
  end
end
