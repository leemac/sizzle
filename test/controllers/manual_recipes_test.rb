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

  test "manual recipes can say when they're good to cook" do
    post imports_url, params: { manual_recipe: fields.merge(meal_times: %w[lunch], seasons: %w[summer]) }

    assert_equal [ %w[lunch], %w[summer] ], Recipe.last.values_at(:meal_times, :seasons)
    assert_no_difference "Recipe.count" do
      post imports_url, params: { manual_recipe: fields.merge(title: "Other", seasons: %w[monsoon]) }
    end
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

  test "ingredient groups are plain bounded headings and a bare hash ends a group" do
    post imports_url, params: { manual_recipe: fields.merge(
      ingredients: "# <b>Rice</b><script>bad()</script>\n1 cup rice\n# #{'x' * 400}\n1 cup coconut milk\n#\n#10 can tomatoes"
    ) }

    recipe = Recipe.last
    assert_redirected_to recipe_url(recipe)
    rice, milk, tomatoes = recipe.ingredients
    assert_equal "Rice", rice["section"]
    assert_equal 300, milk["section"].length
    assert_nil tomatoes["section"]
    assert_equal [ "1 cup rice", "1 cup coconut milk", "#10 can tomatoes" ], recipe.ingredients.map { |line| line["item"] }
    follow_redirect!(headers: inertia_headers)
    assert_equal "Rice", inertia.props[:recipe]["ingredients"].first["section"]
  end

  test "ingredient headings alone do not create a recipe" do
    assert_no_difference "Recipe.count" do
      post imports_url, params: { manual_recipe: fields.merge(ingredients: "# Sauce\n# Finish") }
    end
    follow_redirect!(headers: inertia_headers)
    assert_includes inertia.props[:errors]["ingredients"], "needs at least one ingredient"
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
      source_name: "Not permitted", rating: 5, notes: "not a permitted field"
    ) }

    recipe = Recipe.last
    assert_equal "Rice & beans", recipe.title
    assert_equal "1 cup rice", recipe.ingredients.sole["item"]
    assert_equal "Simmer.", recipe.steps.sole["text"]
    assert_nil recipe.source_url
    assert_nil recipe.source_name
    assert_nil recipe.rating
    assert_nil recipe.notes
    assert_not recipe.cover.attached?
  end

  test "keeps an optional source link without fetching it" do
    assert_no_enqueued_jobs do
      post imports_url, params: { manual_recipe: fields.merge(source_url: " https://www.Example.com/rice?utm_source=ig#notes ") }
    end

    recipe = Recipe.last
    assert_equal "https://www.example.com/rice", recipe.source_url
    assert_equal "example.com", recipe.source_host
    follow_redirect!(headers: inertia_headers)
    assert_equal "https://www.example.com/rice", inertia.props[:recipe]["source_url"]
    assert_equal "example.com", inertia.props[:recipe]["source_host"]
  end

  test "rejects source links that aren't new web links" do
    Recipe.create!(title: "Saved rice", source_url: "https://example.com/rice")

    [ "javascript:alert(1)", "data:text/html,hi", "ftp://example.com/rice", "https://", "http://exa mple.com",
      "https://example.com/#{'x' * 2048}", "https://example.com/rice?utm_source=ig" ].each do |invalid|
      assert_no_difference "Recipe.count", invalid do
        post imports_url, params: { manual_recipe: fields.merge(source_url: invalid) }
      end
      assert_redirected_to imports_url(mode: "manual")
      follow_redirect!(headers: inertia_headers)
      assert inertia.props[:errors]["source_url"], invalid
    end
  end

  test "writing a failed link import manually starts with its link" do
    failed = Import.create!(kind: "url", url: "https://example.com/rice", origin: "web", status: "failed")
    pasted = Import.create!(kind: "text", text: "1 cup rice", origin: "web", status: "failed")

    get imports_url(mode: "manual", from: failed.id), headers: inertia_headers
    assert_equal "https://example.com/rice", inertia.props[:source_url]

    get imports_url(mode: "manual", from: pasted.id), headers: inertia_headers
    assert_nil inertia.props[:source_url]

    get imports_url(mode: "manual"), headers: inertia_headers
    assert_nil inertia.props[:source_url]
  end

  test "a duplicate source offers the saved recipe including archived matches" do
    saved = Recipe.create!(title: "Saved rice", source_url: "https://example.com/rice", archived_at: Time.current)
    assert_no_difference "Recipe.count" do
      post imports_url, params: { manual_recipe: fields.merge(source_url: "https://example.com/rice?utm_source=ig") }
    end
    follow_redirect!(headers: inertia_headers)
    assert_equal({ "id" => saved.id, "title" => saved.title, "archived" => true }, inertia.props[:source_duplicate])
    assert saved.reload.archived?
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
