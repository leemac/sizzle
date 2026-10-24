require "test_helper"

class Api::ImportsControllerTest < ActionDispatch::IntegrationTest
  include ActiveJob::TestHelper

  teardown { ENV.delete("SIZZLE_API_TOKEN") }

  test "accepts a JSON URL import and enqueues it" do
    assert_enqueued_with(job: ImportJob) do
      post api_imports_url, params: { url: "https://example.com/pie" }, as: :json
    end

    assert_response :accepted
    body = response.parsed_body
    assert_equal "queued", body["status"]
    assert_equal "share", Import.find(body["id"]).origin
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
end
