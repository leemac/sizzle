require "test_helper"

class SetupControllerTest < ActionDispatch::IntegrationTest
  setup do
    @settings = %w[ANTHROPIC_API_KEY SIZZLE_API_TOKEN]
    @original_settings = ENV.to_h.slice(*@settings)
    @settings.each { |name| ENV.delete(name) }
  end

  teardown do
    @settings.each { |name| ENV.delete(name) }
    ENV.update(@original_settings)
  end

  test "setup starts with the cookbook without requiring AI" do
    get setup_url

    assert_response :success
    assert_equal "setup/show", inertia.component
    assert_equal "welcome", inertia.props[:step]
    assert_equal({ "claude_configured" => false, "version" => "dev" }, inertia.props[:setup])
  end

  test "whitespace credentials are not treated as configured" do
    ENV["ANTHROPIC_API_KEY"] = "  "
    ENV["SIZZLE_API_TOKEN"] = "  "

    get setup_url

    assert_not inertia.props[:setup]["claude_configured"]
  end

  test "exposes only configuration flags and never the credentials" do
    ENV["ANTHROPIC_API_KEY"] = "setup-test-claude-credential"
    ENV["SIZZLE_API_TOKEN"] = "setup-test-share-credential"
    choose_look

    %w[welcome look ready claude].each do |step|
      get setup_url, params: { step: }

      assert_equal step, inertia.props[:step]
      assert_equal({ "claude_configured" => true, "version" => "dev" }, inertia.props[:setup])
      assert_not response.body.include?(ENV.fetch("ANTHROPIC_API_KEY")), "Setup must not expose the Claude credential"
      assert_not response.body.include?(ENV.fetch("SIZZLE_API_TOKEN")), "Setup must not expose the share credential"
    end
  end

  test "picking a look comes after the welcome and lists every theme" do
    get setup_url, params: { step: "look" }

    assert_equal "look", inertia.props[:step]
    assert_equal Theme.all.map(&:id), inertia.props[:themes].map { |theme| theme["id"] }
  end

  test "other steps don't carry the theme list" do
    get setup_url

    assert_nil inertia.props[:themes]
  end

  test "setup can't skip past picking a look" do
    get setup_url, params: { step: "ready" }
    assert_redirected_to setup_url(step: "look")

    cookies[:sizzle_theme] = "pesto"
    get setup_url, params: { step: "ready" }
    assert_redirected_to setup_url(step: "look"), "A theme alone isn't a full choice"

    choose_look
    get setup_url, params: { step: "ready" }
    assert_response :success
    assert_equal "ready", inertia.props[:step]
  end

  test "old privacy step links skip to the first recipe" do
    get setup_url, params: { step: "privacy" }

    assert_redirected_to setup_url(step: "ready")
  end

  test "invalid step input falls back to the welcome screen" do
    get setup_url, params: { step: "<script>invalid-step</script>" }

    assert_equal "welcome", inertia.props[:step]
  end

  test "setup is guidance and does not accept configuration writes" do
    post setup_url, params: { ANTHROPIC_API_KEY: "ignored" }

    assert_response :not_found
    assert_nil ENV["ANTHROPIC_API_KEY"]
  end

  private

  def choose_look
    patch appearance_url, params: { theme: "pesto", mode: "dark" }
  end
end
