require "test_helper"

class SettingsControllerTest < ActionDispatch::IntegrationTest
  test "settings are read only and expose configuration status, never credentials" do
    original_key = ENV["ANTHROPIC_API_KEY"]
    original_token = ENV["SIZZLE_API_TOKEN"]
    ENV["ANTHROPIC_API_KEY"] = "test-configuration-key"
    ENV["SIZZLE_API_TOKEN"] = "test-share-token"
    assert_no_difference([ "Recipe.count", "Import.count" ]) { get settings_url }
    assert_response :success
    assert_equal "settings/show", inertia.component
    assert_equal true, inertia.props[:instance][:api_protected]
    assert_equal "automatic", inertia.props[:preferences][:ai_mode]
    assert_not_includes response.body, "test-configuration-key"
    assert_not_includes response.body, "test-share-token"
    assert_nil Array(response.headers["Set-Cookie"]).join[/sizzle_(sort|ai_mode)=/]
  ensure
    original_key ? ENV["ANTHROPIC_API_KEY"] = original_key : ENV.delete("ANTHROPIC_API_KEY")
    original_token ? ENV["SIZZLE_API_TOKEN"] = original_token : ENV.delete("SIZZLE_API_TOKEN")
  end

  test "preferences persist per browser and partial updates preserve other choices" do
    patch settings_url, params: { preferences: { text_size: "large", keep_awake: "on", ai_mode: "automatic" } }
    assert_redirected_to settings_url
    assert_match(/sizzle_text_size=large;.*httponly/i, Array(response.headers["Set-Cookie"]).join("\n"))
    patch settings_url, params: { preferences: { sort: "alphabetical" } }
    get root_url
    assert_equal({ "text_size" => "large", "keep_awake" => "on", "ai_mode" => "automatic", "sort" => "alphabetical" }, inertia.props[:preferences])
    assert_equal "alphabetical", inertia.props[:sort]
  end

  test "invalid values cannot replace saved preferences or enter the page through cookies" do
    patch settings_url, params: { preferences: { sort: "alphabetical" } }
    patch settings_url, params: { preferences: { sort: "title; DROP TABLE recipes", ai_mode: "yes" } }
    assert_redirected_to settings_url
    get root_url
    assert_equal "alphabetical", inertia.props[:sort]
    assert_equal "automatic", inertia.props[:preferences][:ai_mode]
    cookies[:sizzle_sort] = "title; DROP TABLE recipes"
    cookies[:sizzle_ai_mode] = "yes"
    get root_url
    assert_equal "newest", inertia.props[:sort]
    assert_equal "automatic", inertia.props[:preferences][:ai_mode]
  end

  test "cookbook sorting retains filters and redirects only to fixed local routes" do
    patch settings_url, params: { preferences: { sort: "alphabetical" }, return_to: "cookbook", q: "rice", diet: "vegan" }
    assert_redirected_to root_url(q: "rice", diet: "vegan")
    patch settings_url, params: { preferences: { sort: "newest" }, return_to: "https://evil.example" }
    assert_redirected_to settings_url
  end

  test "preference writes require CSRF protection" do
    ActionController::Base.allow_forgery_protection = true
    patch settings_url, params: { preferences: { ai_mode: "automatic" } }
    assert_response :unprocessable_content
    assert_nil Array(response.headers["Set-Cookie"]).join[/sizzle_ai_mode=/]
  ensure
    ActionController::Base.allow_forgery_protection = false
  end
end
