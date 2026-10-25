require "test_helper"

class Api::ImportsControllerTest < ActionDispatch::IntegrationTest
  include ActiveJob::TestHelper

  RECIPE_TEXT = "Apple pie\n2 cups flour, 1 cup butter, 6 apples\nBake at 200C for 45 minutes.".freeze

  teardown { ENV.delete("SIZZLE_API_TOKEN") }

  test "accepts a JSON URL import and enqueues it" do
    assert_enqueued_with(job: ImportJob) do
      post api_imports_url, params: { url: "https://example.com/pie" }, as: :json
    end

    assert_response :accepted
    body = response.parsed_body
    assert_equal "queued", body["status"]
    assert_equal "share", Import.find(body["id"]).origin
    assert Import.find(body["id"]).ai_allowed?, "API imports retain server configuration independently of browser preferences"
  end

  test "rejects non-JSON requests so other websites can't submit imports from a browser" do
    post api_imports_url, params: { url: "https://example.com/pie" }

    assert_response :unsupported_media_type
    assert_equal 0, Import.count
  end

  test "rejects URLs that can't be fetched safely" do
    post api_imports_url, params: { url: "file:///etc/passwd" }, as: :json

    assert_response :unprocessable_content
  end

  test "requires the bearer token when SIZZLE_API_TOKEN is set" do
    ENV["SIZZLE_API_TOKEN"] = "s3cret-token"

    post api_imports_url, params: { url: "https://example.com/pie" }, as: :json
    assert_response :unauthorized

    post api_imports_url, params: { url: "https://example.com/pie" }, as: :json,
                          headers: { "Authorization" => "Bearer wrong" }
    assert_response :unauthorized

    post api_imports_url, params: { url: "https://example.com/pie" }, as: :json,
                          headers: { "Authorization" => "Bearer s3cret-token" }
    assert_response :accepted
  end

  test "reports import status" do
    import = Import.create!(kind: "url", url: "https://example.com/pie", origin: "share")

    get api_import_url(import), as: :json

    assert_response :success
    assert_equal import.id, response.parsed_body["id"]
  end

  test "accepts shared recipe text in the text field" do
    assert_enqueued_with(job: ImportJob) do
      post api_imports_url, params: { text: RECIPE_TEXT }, as: :json
    end

    assert_response :accepted
    import = Import.find(response.parsed_body["id"])
    assert_equal "text", import.kind
    assert_equal RECIPE_TEXT, import.text
    assert_equal "share", import.origin
  end

  test "treats a link sent in the text field as a URL import" do
    post api_imports_url, params: { text: "https://example.com/pie" }, as: :json

    assert_response :accepted
    import = Import.find(response.parsed_body["id"])
    assert_equal "url", import.kind
    assert_equal "https://example.com/pie", import.url
  end

  test "validates links sent in the text field like links sent in the url field" do
    post api_imports_url, params: { text: "https://example.com:6379/" }, as: :json

    assert_response :unprocessable_content
    assert_equal 0, Import.count
  end

  test "keeps the url field strict: recipe text there is rejected, not guessed at" do
    post api_imports_url, params: { url: RECIPE_TEXT }, as: :json

    assert_response :unprocessable_content
    assert_equal 0, Import.count
  end

  test "rejects an empty request" do
    post api_imports_url, params: {}, as: :json

    assert_response :unprocessable_content
  end
end
