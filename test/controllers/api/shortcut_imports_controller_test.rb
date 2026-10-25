require "test_helper"
require_relative "../../support/rate_limit_store"

class Api::ShortcutImportsControllerTest < ActionDispatch::IntegrationTest
  include RateLimitStore
  include ActiveJob::TestHelper

  setup do
    @previous_pairing = ENV["SIZZLE_SHORTCUT_PAIRING"]
    @previous_token = ENV["SIZZLE_API_TOKEN"]
    ENV["SIZZLE_SHORTCUT_PAIRING"] = "true"
    ENV["SIZZLE_API_TOKEN"] = SecureRandom.hex(32)
    @connection, code = ShortcutConnection.issue!(name: "Phone")
    @token = ShortcutConnection.redeem(code)
    @headers = { "Authorization" => "Bearer #{@token}" }
  end

  teardown do
    ENV["SIZZLE_SHORTCUT_PAIRING"] = @previous_pairing
    ENV["SIZZLE_API_TOKEN"] = @previous_token
  end

  test "a device credential submits a validated import without the server API token" do
    assert_enqueued_with(job: ImportJob) do
      post api_shortcut_imports_url, params: { text: "https://example.com/pie" }, as: :json, headers: @headers
    end
    assert_response :accepted
    assert_equal "queued", response.parsed_body["status"]
    assert_equal "share", Import.last.origin
    assert_equal "url", Import.last.kind
  end

  test "missing wrong revoked and disabled credentials cannot submit even without a global token" do
    ENV.delete("SIZZLE_API_TOKEN")
    assert_no_difference "Import.count" do
      post api_shortcut_imports_url, params: { text: "Recipe" }, as: :json
      assert_response :unauthorized
      post api_shortcut_imports_url, params: { text: "Recipe" }, as: :json, headers: { "Authorization" => "Bearer wrong" }
      assert_response :unauthorized
      @connection.reload.revoke!
      post api_shortcut_imports_url, params: { text: "Recipe" }, as: :json, headers: @headers
      assert_response :unauthorized
      ENV.delete("SIZZLE_SHORTCUT_PAIRING")
      post api_shortcut_imports_url, params: { text: "Recipe" }, as: :json, headers: @headers
      assert_response :not_found
    end
  end

  test "device credentials cannot use the existing script API or read routes" do
    post api_imports_url, params: { text: "Recipe" }, as: :json, headers: @headers
    assert_response :unauthorized
    import = Import.create!(kind: "text", text: "Recipe", origin: "web")
    get api_import_url(import), as: :json, headers: @headers
    assert_response :unauthorized
    get api_shortcut_imports_url, as: :json, headers: @headers
    assert_response :not_found
    post api_shortcut_imports_url, params: { text: "Recipe" }, as: :json,
      headers: { "Authorization" => "Bearer #{ENV.fetch('SIZZLE_API_TOKEN')}" }
    assert_response :unauthorized
  end

  test "device imports preserve JSON only and SSRF guards" do
    assert_no_difference "Import.count" do
      post api_shortcut_imports_url, params: { text: "Recipe" }, headers: @headers
      assert_response :unsupported_media_type
      post api_shortcut_imports_url, params: { text: "http://example.com:6379/private" }, as: :json, headers: @headers
      assert_response :unprocessable_content
      post api_shortcut_imports_url, params: { text: "" }, as: :json, headers: @headers
      assert_response :unprocessable_content
    end
  end

  test "device imports use the existing import rate limit" do
    with_memory_rate_limits(Api::ShortcutImportsController) do
      30.times do
        post api_shortcut_imports_url, params: { text: "Recipe" }, as: :json, headers: @headers
        assert_response :accepted
      end
      assert_no_difference "Import.count" do
        post api_shortcut_imports_url, params: { text: "Recipe" }, as: :json, headers: @headers
        assert_response :too_many_requests
      end
    end
  end
end
