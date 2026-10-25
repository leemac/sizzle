require "test_helper"
require_relative "../support/rate_limit_store"

class ShortcutConnectionsControllerTest < ActionDispatch::IntegrationTest
  include RateLimitStore
  setup do
    @previous_pairing = ENV["SIZZLE_SHORTCUT_PAIRING"]
    ENV["SIZZLE_SHORTCUT_PAIRING"] = "true"
  end

  teardown { ENV["SIZZLE_SHORTCUT_PAIRING"] = @previous_pairing }

  test "pairing is opt in and disabled routes cannot read or change connections" do
    connection, code = ShortcutConnection.issue!(name: "Phone")
    ENV.delete("SIZZLE_SHORTCUT_PAIRING")
    assert_no_changes -> { connection.reload.attributes } do
      get share_shortcut_url
      assert_response :not_found
      post shortcut_connections_url, params: { name: "Phone" }, as: :json
      assert_response :not_found
      delete shortcut_connection_url(connection)
      assert_response :not_found
      post api_shortcut_pairings_url, params: { pairing_token: code }, as: :json
      assert_response :not_found
      post api_shortcut_imports_url, params: { text: "Recipe" }, as: :json
      assert_response :not_found
    end
    get share_url
    assert_nil inertia.props[:shortcut_pairing]
  end

  test "creating a connection passes only a single use pairing code to the shortcut" do
    post shortcut_connections_url, params: { name: "Kitchen phone" }, as: :json
    assert_response :success
    assert_equal "no-store", response.headers["Cache-Control"]
    url = URI(response.parsed_body.fetch("connect_url"))
    assert_equal "shortcuts", url.scheme
    query = Rack::Utils.parse_query(url.query)
    assert_equal "Save to Sizzle", query["name"]
    setup = JSON.parse(query.fetch("text"))
    assert_equal 1, setup["sizzle_pairing"]
    assert_equal api_shortcut_pairings_url, setup["pairing_url"]
    assert ShortcutConnection.redeem(setup["pairing_token"])
    get share_url
    props = inertia.props[:shortcut_pairing]
    assert_equal [ { "id" => ShortcutConnection.last.id, "name" => "Kitchen phone", "connected" => true } ], props["connections"]
    assert_not_includes response.body, setup["pairing_token"]
    assert_not_includes response.body, "credential_digest"
  end

  test "pairing creation and revocation require CSRF protection" do
    previous = ActionController::Base.allow_forgery_protection
    ActionController::Base.allow_forgery_protection = true
    connection, = ShortcutConnection.issue!(name: "Phone")
    assert_no_changes -> { ShortcutConnection.count } do
      post shortcut_connections_url, params: { name: "Phone" }, as: :json
      assert_response :unprocessable_content
    end
    assert_no_changes -> { connection.reload.revoked_at } do
      delete shortcut_connection_url(connection)
      assert_response :unprocessable_content
    end
  ensure
    ActionController::Base.allow_forgery_protection = previous
  end

  test "GET requests do not create or revoke connections and page loads are read only" do
    connection, = ShortcutConnection.issue!(name: "Phone")
    assert_no_changes -> { connection.reload.attributes } do
      get share_url
      assert_response :success
      get shortcut_connections_url
      assert_response :not_found
      get shortcut_connection_url(connection)
      assert_response :not_found
      get api_shortcut_pairings_url
      assert_response :not_found
    end
  end

  test "disconnecting invalidates the device credential" do
    connection, code = ShortcutConnection.issue!(name: "Phone")
    token = ShortcutConnection.redeem(code)
    delete shortcut_connection_url(connection)
    assert_redirected_to share_url
    assert_nil ShortcutConnection.authenticate(token)
  end

  test "connection creation is rate limited" do
    with_memory_rate_limits(ShortcutConnectionsController) do
      5.times do
        post shortcut_connections_url, params: { name: "Phone" }, as: :json
        assert_response :success
      end
      assert_no_difference "ShortcutConnection.count" do
        post shortcut_connections_url, params: { name: "Another" }, as: :json
        assert_response :too_many_requests
      end
    end
  end

  test "the download is a signed shortcut attachment" do
    get share_shortcut_url
    assert_response :success
    assert_equal "application/x-shortcut", response.media_type
    assert_includes response.headers["Content-Disposition"], "Save to Sizzle.shortcut"
    assert response.body.bytesize > 1000
  end
end
