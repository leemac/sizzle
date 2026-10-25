require "test_helper"

class AppearancesControllerTest < ActionDispatch::IntegrationTest
  test "a new browser gets the default theme following the device, and hasn't chosen yet" do
    get root_url

    assert_equal({ "theme" => "sunny-side-up", "mode" => "auto", "chosen" => false }, inertia.props[:appearance])
    assert_select "html[data-theme=sunny-side-up][data-mode=auto]"
    assert_select "head style:not([id])", text: Theme.builtin_stylesheet
    assert_select "head style#sizzle-custom-themes", text: ""
    assert_equal "", inertia.props[:theme_css]
  end

  test "the appearance page lists every theme with its colours" do
    get appearance_url

    assert_equal "appearance/show", inertia.component
    themes = inertia.props[:themes]
    assert_equal Theme.all.map(&:id), themes.map { |theme| theme["id"] }
    assert_equal Theme::TOKENS, themes.first["dark"].keys
  end

  test "saving a look stores it in this browser and renders it on the next page" do
    patch appearance_url, params: { theme: "pesto", mode: "dark" }

    assert_redirected_to appearance_url
    assert_equal "Appearance saved.", flash[:notice]
    cookie_headers = Array(response.headers["Set-Cookie"]).join("\n")
    assert_match(/sizzle_theme=pesto;.*httponly/i, cookie_headers)
    assert_match(/sizzle_mode=dark;.*samesite=lax/i, cookie_headers)

    get root_url
    assert_equal({ "theme" => "pesto", "mode" => "dark", "chosen" => true }, inertia.props[:appearance])
    assert_select "html[data-theme=pesto][data-mode=dark]"
    dark = Theme.find("pesto").dark.fetch("porcelain")
    assert_select "meta[name=theme-color][content='#{dark}']", count: 2
  end

  test "saving during setup moves on to the next setup step" do
    patch appearance_url, params: { theme: "hot-sauce", mode: "auto", next: "setup" }

    assert_redirected_to setup_url(step: "ready")
  end

  test "the next step is an allowlist, not a redirect target" do
    [ "https://evil.example", "//evil.example", "/recipes" ].each do |destination|
      patch appearance_url, params: { theme: "pesto", mode: "light", next: destination }

      assert_redirected_to appearance_url
    end
  end

  test "rejects themes and modes that aren't on the list and keeps the old look" do
    patch appearance_url, params: { theme: "pesto", mode: "light" }
    patch appearance_url, params: { theme: "\"><script>alert(1)</script>", mode: "sepia" }

    assert_redirected_to appearance_url
    assert_nil Array(response.headers["Set-Cookie"]).join[/sizzle_(theme|mode)=/]
    follow_redirect!
    assert_equal({ "theme" => "Choose a theme", "mode" => "Choose light, dark or auto" }, inertia.props[:errors])
    assert_equal "pesto", inertia.props[:appearance]["theme"]
  end

  test "a tampered cookie falls back to the default and never reaches the page" do
    cookies[:sizzle_theme] = "\"><script>alert(1)</script>"
    cookies[:sizzle_mode] = "dark\" onload=\"alert(1)"

    get root_url

    assert_select "html[data-theme=sunny-side-up][data-mode=auto]"
    assert_not_includes response.body, "<script>alert(1)"
    assert_not_includes response.body, "onload=\"alert"
    assert_equal false, inertia.props[:appearance]["chosen"]
  end

  test "saving requires a CSRF token" do
    ActionController::Base.allow_forgery_protection = true
    patch appearance_url, params: { theme: "pesto", mode: "dark" }

    assert_response :unprocessable_content
    assert_nil Array(response.headers["Set-Cookie"]).join[/sizzle_theme=/]
  ensure
    ActionController::Base.allow_forgery_protection = false
  end
end
