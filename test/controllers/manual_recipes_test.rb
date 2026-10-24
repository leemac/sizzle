require "test_helper"

class ManualRecipesTest < ActionDispatch::IntegrationTest
  include ActiveJob::TestHelper

  def fields
    { title: "Coconut rice", description: "An easy side.", ingredients: "1 cup rice\n1 cup coconut milk",
      steps: "Rinse the rice.\nSimmer for 20 minutes.", servings: "4", prep_minutes: "5", cook_minutes: "20" }
  end

  def inertia_headers
    { "X-Inertia" => "true", "X-Inertia-Version" => ViteRuby.digest }
  end

  test "manual entry works without Claude, a fetch, or an import job" do
    original_key = ENV.delete("ANTHROPIC_API_KEY")
    get imports_url(mode: "manual"), headers: inertia_headers
    assert_equal "manual", inertia.props[:mode]

    assert_no_enqueued_jobs do
      assert_difference "Recipe.count", 1 do
        assert_no_difference "Import.count" do
          post imports_url, params: { manual_recipe: fields }
        end
      end
    end
    recipe = Recipe.last
    assert_redirected_to recipe_url(recipe)
    assert_equal [ "1 cup rice", "1 cup coconut milk" ], recipe.ingredients.map { |line| line["item"] }
    assert_equal [ "Rinse the rice.", "Simmer for 20 minutes." ], recipe.steps.map { |line| line["text"] }
    assert_equal [ 4, 5, 20, 25 ], recipe.values_at(:servings, :prep_minutes, :cook_minutes, :total_minutes)
    follow_redirect!(headers: inertia_headers)
    assert_equal "Coconut rice", inertia.props[:recipe]["title"]
  ensure
    original_key ? ENV["ANTHROPIC_API_KEY"] = original_key : ENV.delete("ANTHROPIC_API_KEY")
  end

  test "rejects missing fields and returns field errors to the manual form" do
    assert_no_difference "Recipe.count" do
      post imports_url, params: { manual_recipe: { title: " " } }
    end
    assert_redirected_to imports_url(mode: "manual")
    follow_redirect!(headers: inertia_headers)
    assert inertia.props[:errors]["title"]
    assert inertia.props[:errors]["ingredients"]
    assert inertia.props[:errors]["steps"]
  end

  test "rejects excessive or malformed content and invalid numbers" do
    [ { title: "x" * 301 }, { ingredients: Array.new(201, "rice").join("\n") },
      { steps: "x" * 10_001 }, { servings: "-1" }, { cook_minutes: "tomorrow" },
      { title: "<script>bad()</script>" } ].each do |invalid|
      assert_no_difference "Recipe.count" do
        post imports_url, params: { manual_recipe: fields.merge(invalid) }
      end
      assert_redirected_to imports_url(mode: "manual")
    end
  end

  test "stores text without HTML and ignores arbitrary model attributes" do
    post imports_url, params: { manual_recipe: fields.merge(
      title: "<b>Rice &amp; beans</b>", ingredients: '<img src="http://169.254.169.254/">1 cup rice',
      steps: "<script>bad()</script><p>Simmer.</p>",
      source_url: "http://169.254.169.254/", rating: 5, notes: "not a permitted field"
    ) }

    recipe = Recipe.last
    assert_equal "Rice & beans", recipe.title
    assert_equal "1 cup rice", recipe.ingredients.sole["item"]
    assert_equal "Simmer.", recipe.steps.sole["text"]
    assert_nil recipe.source_url
    assert_nil recipe.rating
    assert_nil recipe.notes
    assert_not recipe.cover.attached?
  end

  test "manual submissions retain Rails CSRF protection" do
    original = ActionController::Base.allow_forgery_protection
    ActionController::Base.allow_forgery_protection = true

    assert_no_difference "Recipe.count" do
      post imports_url, params: { manual_recipe: fields }
    end
    assert_response :unprocessable_content
  ensure
    ActionController::Base.allow_forgery_protection = original
  end
end
