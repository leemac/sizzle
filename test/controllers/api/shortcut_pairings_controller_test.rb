require "test_helper"
require_relative "../../support/rate_limit_store"

class Api::ShortcutPairingsControllerTest < ActionDispatch::IntegrationTest
  include RateLimitStore
  setup do
    @previous_pairing = ENV["SIZZLE_SHORTCUT_PAIRING"]
    ENV["SIZZLE_SHORTCUT_PAIRING"] = "true"
    @connection, @code = ShortcutConnection.issue!(name: "Phone")
  end

  teardown { ENV["SIZZLE_SHORTCUT_PAIRING"] = @previous_pairing }

  test "redeems exactly once and does not cache credentials" do
    post api_shortcut_pairings_url, params: { pairing_token: @code }, as: :json
    assert_response :created
    assert_equal "no-store", response.headers["Cache-Control"]
    assert_equal api_shortcut_imports_url, response.parsed_body["endpoint"]
    assert_equal @connection, ShortcutConnection.authenticate(response.parsed_body["token"])
    post api_shortcut_pairings_url, params: { pairing_token: @code }, as: :json
    assert_response :unauthorized
    assert_nil response.parsed_body["token"]
  end

  test "rejects browser form requests and does not enable cross origin access" do
    post api_shortcut_pairings_url, params: { pairing_token: @code }
    assert_response :unsupported_media_type
    assert_nil @connection.reload.connected_at
    post api_shortcut_pairings_url, params: { pairing_token: "invalid" }, as: :json,
      headers: { "Origin" => "https://attacker.example" }
    assert_response :unauthorized
    assert_nil response.headers["Access-Control-Allow-Origin"]
  end

  test "rejects expired and malformed pairing requests without issuing a credential" do
    [ {}, { pairing_token: [] }, { pairing_token: "wrong" } ].each do |payload|
      post api_shortcut_pairings_url, params: payload, as: :json
      assert_response :unauthorized
    end
    travel_to @connection.pairing_expires_at, with_usec: true do
      post api_shortcut_pairings_url, params: { pairing_token: @code }, as: :json
      assert_response :unauthorized
    end
    assert_nil @connection.reload.credential_digest
  end

  test "redemption is rate limited" do
    with_memory_rate_limits(Api::ShortcutPairingsController) do
      10.times do
        post api_shortcut_pairings_url, params: { pairing_token: "wrong" }, as: :json
        assert_response :unauthorized
      end
      post api_shortcut_pairings_url, params: { pairing_token: @code }, as: :json
      assert_response :too_many_requests
      assert_nil @connection.reload.connected_at
    end
  end
end
