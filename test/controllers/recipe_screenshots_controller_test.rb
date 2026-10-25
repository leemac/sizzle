require "test_helper"
require_relative "../support/rate_limit_store"

class RecipeScreenshotsControllerTest < ActionDispatch::IntegrationTest
  include RateLimitStore

  PNG = "\x89PNG\r\n\x1A\n".b + "screenshot".b

  setup do
    @original_key = ENV["ANTHROPIC_API_KEY"]
    ENV["ANTHROPIC_API_KEY"] = "test-key"
    @requests = []
    @answer = FakeExtractor.recipe
    stub_request(:post, "https://api.anthropic.com/v1/messages").to_return do |request|
      @requests << JSON.parse(request.body)
      {
        headers: { "Content-Type" => "application/json" },
        body: {
          id: "msg_screenshot", type: "message", role: "assistant", model: "claude-opus-5-5",
          content: [ { type: "text", text: @answer.to_json } ], stop_reason: "end_turn", stop_sequence: nil,
          usage: { input_tokens: 100, output_tokens: 100 }
        }.to_json
      }
    end
  end

  teardown do
    @original_key ? ENV["ANTHROPIC_API_KEY"] = @original_key : ENV.delete("ANTHROPIC_API_KEY")
  end

  def screenshot(bytes = PNG)
    Rack::Test::UploadedFile.new(StringIO.new(bytes), "image/png", true, original_filename: "screenshot.png")
  end

  test "reads screenshots with Claude and returns form fields without saving anything" do
    assert_no_difference [ "Recipe.count", "Import.count" ] do
      post recipe_screenshots_url, params: { screenshots: [ screenshot, screenshot ] }
    end

    assert_response :success
    assert_equal "no-store", response.headers["Cache-Control"]
    fields = response.parsed_body["fields"]
    assert_equal "Weeknight Chickpea Curry", fields["title"]
    assert_equal "1½ cups chickpeas, drained", fields["ingredients"]

    request = @requests.sole
    assert_not request.key?("tools"), "the extraction call must never have tools"
    content = request["messages"].sole["content"]
    images = content.select { |block| block["type"] == "image" }
    assert_equal 2, images.size
    assert_equal({ "type" => "base64", "media_type" => "image/png", "data" => Base64.strict_encode64(PNG) }, images.first["source"])
    assert_equal "text", content.last["type"]
  end

  test "rejects files that aren't images before calling Claude" do
    post recipe_screenshots_url, params: { screenshots: [ screenshot("GIF8 not quite") ] }

    assert_response :unprocessable_content
    assert_match "PNG, JPEG", response.parsed_body["error"]
    assert_empty @requests
  end

  test "refuses an oversized or unsized body before parsing it" do
    ActionController::Base.allow_forgery_protection = true
    [ RecipeScreenshotsController::MAX_BODY_BYTES + 1, nil ].each do |length|
      headers = { "CONTENT_TYPE" => "multipart/form-data; boundary=x", "CONTENT_LENGTH" => length&.to_s }.compact
      post recipe_screenshots_url, headers:, env: { "rack.input" => StringIO.new("--x--\r\n") }

      assert_response :content_too_large
      assert_match "MB or less", response.parsed_body["error"]
    end
    assert_empty @requests
  ensure
    ActionController::Base.allow_forgery_protection = false
  end

  test "explains when Claude isn't set up" do
    ENV.delete("ANTHROPIC_API_KEY")

    post recipe_screenshots_url, params: { screenshots: [ screenshot ] }

    assert_response :unprocessable_content
    assert_match "ANTHROPIC_API_KEY", response.parsed_body["error"]
    assert_empty @requests
  end

  test "Claude errors come back as a message for the form" do
    @answer = FakeExtractor.recipe("is_recipe" => false)

    post recipe_screenshots_url, params: { screenshots: [ screenshot ] }

    assert_response :unprocessable_content
    assert_match "No recipe found", response.parsed_body["error"]
  end

  test "requires the page's CSRF token" do
    ActionController::Base.allow_forgery_protection = true
    post recipe_screenshots_url, params: { screenshots: [ screenshot ] }

    assert_response :unprocessable_content
    assert_empty @requests
  ensure
    ActionController::Base.allow_forgery_protection = false
  end

  test "is rate limited" do
    with_memory_rate_limits(RecipeScreenshotsController) do
      10.times { post recipe_screenshots_url, params: { screenshots: [ screenshot ] } }
      post recipe_screenshots_url, params: { screenshots: [ screenshot ] }

      assert_response :too_many_requests
      assert_equal 10, @requests.size
    end
  end

  test "charges the cookbook-wide import budget" do
    store = RecipeScreenshotsController.cache_store
    RecipeScreenshotsController.cache_store = ActiveSupport::Cache::MemoryStore.new
    RecipeScreenshotsController.cache_store.write(ImportBudget::KEY, ImportBudget::LIMIT, raw: true)

    post recipe_screenshots_url, params: { screenshots: [ screenshot ] }

    assert_response :too_many_requests
    assert_empty @requests
  ensure
    RecipeScreenshotsController.cache_store = store
  end
end
