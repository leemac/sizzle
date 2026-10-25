require "test_helper"

class ThemesControllerTest < ActionDispatch::IntegrationTest
  setup do
    @original_setting = ENV["SIZZLE_THEME_EDITOR"]
    ENV["SIZZLE_THEME_EDITOR"] = "true"
  end

  teardown do
    ENV["SIZZLE_THEME_EDITOR"] = @original_setting
  end

  test "the editor is off unless SIZZLE_THEME_EDITOR is set, and saved themes stay pickable" do
    custom = CustomTheme.create!(theme_params)
    ENV.delete("SIZZLE_THEME_EDITOR")

    assert_no_changes -> { [ CustomTheme.count, custom.reload.attributes ] } do
      get new_theme_url
      assert_response :not_found
      get edit_theme_url(custom)
      assert_response :not_found
      post themes_url, params: { theme: theme_params(name: "Another") }
      assert_response :not_found
      patch theme_url(custom), params: { theme: theme_params(name: "Changed") }
      assert_response :not_found
      delete theme_url(custom)
      assert_response :not_found
    end

    get appearance_url
    assert_equal false, inertia.props[:app][:theme_editor]
    assert_includes inertia.props[:themes].map { |theme| theme["id"] }, custom.theme_id
    patch appearance_url, params: { theme: custom.theme_id, mode: "light" }
    assert_redirected_to appearance_url
    get root_url
    assert_equal custom.theme_id, inertia.props[:appearance]["theme"]
  end

  test "the shared props say when the editor is on" do
    get appearance_url

    assert_equal true, inertia.props[:app][:theme_editor]
  end

  def theme_params(**overrides)
    { name: "Midnight snack", description: "For late cooking.", light: Theme.default.light, dark: Theme.find("pesto").dark }.merge(overrides)
  end

  test "a new theme starts as a copy of the chosen one" do
    get new_theme_url, params: { from: "beet-it" }

    assert_equal "themes/edit", inertia.component
    draft = inertia.props[:theme]
    assert_nil draft["id"]
    assert_equal "My beet it", draft["name"]
    assert_equal Theme.find("beet-it").dark, draft["dark"]
    assert_equal "Beet it", inertia.props[:based_on]
  end

  test "an unknown starting theme falls back to the one this browser uses" do
    patch appearance_url, params: { theme: "pesto", mode: "dark" }

    get new_theme_url, params: { from: "\"><script>" }

    assert_equal "Pesto", inertia.props[:based_on]
  end

  test "opening the editor saves nothing" do
    assert_no_difference -> { CustomTheme.count } do
      get new_theme_url
    end
  end

  test "saving a theme stores it and switches this browser to it, keeping its mode" do
    patch appearance_url, params: { theme: "pesto", mode: "dark" }

    assert_difference -> { CustomTheme.count } do
      post themes_url, params: { theme: theme_params }
    end

    custom = CustomTheme.last
    assert_redirected_to appearance_url
    get root_url
    assert_equal({ "theme" => custom.theme_id, "mode" => "dark", "chosen" => true }, inertia.props[:appearance].except("colors"))
    assert_select "html[data-theme=#{custom.theme_id}]"
    assert_includes css_block, ":root[data-theme=#{custom.theme_id}]{--color-porcelain:#{Theme.default.light['porcelain']};"
    # Pages reached without a full reload get the new theme's CSS from this prop.
    assert_includes inertia.props[:theme_css], ":root[data-theme=#{custom.theme_id}][data-mode=dark]{"
  end

  test "hostile colours and names are rejected or escaped, never written into the page" do
    hostile = Theme.default.light.merge("paper" => "#fff}body{background:url(//evil.example)")

    assert_no_difference -> { CustomTheme.count } do
      post themes_url, params: { theme: theme_params(light: hostile) }, headers: { "Referer" => new_theme_url }
    end
    assert_redirected_to new_theme_url
    follow_redirect!
    assert_match "paper must be a #rrggbb colour", inertia.props[:errors]["light"]

    post themes_url, params: { theme: theme_params(name: "</style><script>alert(1)</script>") }
    get root_url
    assert_not_includes response.body, "<script>alert(1)"
    assert_not_includes css_block, "evil.example"
  end

  test "tokens outside the list are dropped before saving" do
    post themes_url, params: { theme: theme_params(light: Theme.default.light.merge("background-image" => "#123456")) }

    assert_equal Theme::TOKENS.sort, CustomTheme.last.light.keys.sort
  end

  test "editing and updating a custom theme" do
    custom = CustomTheme.create!(theme_params)

    get edit_theme_url(custom)
    assert_equal custom.id, inertia.props[:theme]["id"]
    assert_nil inertia.props[:based_on]

    patch theme_url(custom), params: { theme: theme_params(name: "Midnight feast", light: Theme.default.light.merge("action" => "#123456")) }
    assert_redirected_to appearance_url
    assert_equal [ "Midnight feast", "#123456" ], [ custom.reload.name, custom.light["action"] ]
  end

  test "deleting a theme sends browsers using it back to the default" do
    custom = CustomTheme.create!(theme_params)
    patch appearance_url, params: { theme: custom.theme_id, mode: "light" }

    delete theme_url(custom)

    assert_redirected_to appearance_url
    assert_not CustomTheme.exists?(custom.id)
    get root_url
    assert_equal({ "theme" => "sunny-side-up", "mode" => "light", "chosen" => false }, inertia.props[:appearance].except("colors"))
  end

  test "built-in themes can't be edited or deleted" do
    assert_no_difference -> { CustomTheme.count } do
      get edit_theme_url("pesto")
      assert_response :not_found
      delete theme_url("pesto")
      assert_response :not_found
    end
  end

  test "saving requires a CSRF token" do
    ActionController::Base.allow_forgery_protection = true

    assert_no_difference -> { CustomTheme.count } do
      post themes_url, params: { theme: theme_params }
    end
    assert_response :unprocessable_content
  ensure
    ActionController::Base.allow_forgery_protection = false
  end

  private

  def css_block = css_select("head style").text
end
