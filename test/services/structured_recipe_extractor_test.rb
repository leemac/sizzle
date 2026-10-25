require "test_helper"

class StructuredRecipeExtractorTest < ActiveSupport::TestCase
  setup do
    @page = PageScraper.parse(file_fixture_html("recipe_page.html"), base_url: "https://example.com/curry")
    @data = @page.structured_recipe.deep_dup
  end

  def extract(overrides = {})
    StructuredRecipeExtractor.new.from_page(@page.with(structured_recipe: @data.merge(overrides)))
  end

  test "keeps original ingredient wording without inventing quantities" do
    result = extract

    assert result["is_recipe"]
    assert_equal "Weeknight Chickpea Curry", result["title"]
    assert_equal "1 1/2 cups chickpeas, drained", result["ingredients"].sole["item"]
    assert_nil result["ingredients"].sole["quantity"]
    assert_equal [ { "section" => nil, "text" => "Simmer." } ], result["steps"]
    assert_equal "img1", result["hero_image_id"]
  end

  test "supports strings, HTML lists, HowToStep and nested HowToSection instructions" do
    assert_equal [ "Mix.", "Bake." ], extract("recipeInstructions" => "<ol><li>Mix.</li><li>Bake.</li></ol>")["steps"].map { |step| step["text"] }
    result = extract("recipeInstructions" => [
      { "@type" => "HowToSection", "name" => "For the sauce", "itemListElement" => [
        { "@type" => "HowToStep", "text" => "Simmer." }, "Cool."
      ] },
      { "@type" => "HowToStep", "text" => "Serve." }
    ])
    assert_equal [
      { "section" => "For the sauce", "text" => "Simmer." },
      { "section" => "For the sauce", "text" => "Cool." },
      { "section" => nil, "text" => "Serve." }
    ], result["steps"]
  end

  test "maps optional metadata and bounded ISO durations" do
    result = extract("prepTime" => "PT10M", "cookTime" => "PT1H30M", "totalTime" => "P1DT30S",
                     "recipeYield" => [ "4 servings" ], "author" => [ { "@type" => "Person", "name" => "Sam Cook" } ],
                     "recipeCuisine" => [ "Indian" ], "recipeCategory" => "Main Course",
                     "suitableForDiet" => [ "https://schema.org/VeganDiet", "UnknownDiet", "LowLactoseDiet" ])

    assert_equal [ 10, 90, 1441 ], result.values_at("prep_minutes", "cook_minutes", "total_minutes")
    assert_equal 4, result["servings"]
    assert_equal "4 servings", result["yield_text"]
    assert_equal "Sam Cook", result["author"]
    assert_equal "Indian", result["cuisine"]
    assert_equal "main", result["course"]
    assert_equal [ "vegan" ], result["diets"]
    assert_equal 30, extract("prepTime" => "PT10M", "cookTime" => "PT20M")["total_minutes"]
    assert_equal 4, extract("recipeYield" => 4)["servings"]
    assert_empty extract("suitableForDiet" => [ 123, { "name" => "VeganDiet" }, "https://unrelated.example/VeganDiet" ])["diets"]
  end

  test "reads meal times from the category and seasons from categories and keywords" do
    result = extract("recipeCategory" => [ "Lunch", "Supper", "Main Course" ], "keywords" => "soup, Autumn, fall,winter")

    assert_equal %w[lunch dinner], result["meal_times"]
    assert_equal %w[autumn winter], result["seasons"]
    assert_equal %w[summer], extract("keywords" => [ "Summer", 3, { "a" => "spring" } ])["seasons"]
    assert_empty extract("recipeCategory" => { "name" => "Lunch" }, "keywords" => 42)["meal_times"]
    draft = RecipeDraft.new(extract("recipeCategory" => "Dinner", "keywords" => "Summer"))
    assert_equal [ %w[dinner], %w[summer] ], draft.attributes.values_at(:meal_times, :seasons)
  end

  test "does not invent optional metadata from invalid values or ranges" do
    result = extract("recipeYield" => "4–6 servings", "author" => { "url" => "https://example.com" },
                     "prepTime" => "ten minutes", "cookTime" => "PT999999M", "totalTime" => "PT",
                     "recipeCuisine" => { "bad" => "type" }, "recipeCategory" => "Unknown course")

    %w[servings author prep_minutes cook_minutes total_minutes cuisine course].each { |key| assert_nil result[key] }
  end

  test "strips hostile HTML from every stored text field without fetching resources" do
    result = extract("name" => "<b>Curry &amp; rice</b>", "description" => '<img src="http://169.254.169.254/"><script>bad()</script>Warm curry.',
                     "author" => "<i>Sam</i>", "recipeIngredient" => [ "<b>1 cup rice</b>" ],
                     "recipeInstructions" => [ { "name" => "<b>Finish</b>", "itemListElement" => [ "<p>Serve &amp; enjoy.</p>" ] } ])

    assert_equal "Curry & rice", result["title"]
    assert_equal "Warm curry.", result["description"]
    assert_equal "Sam", result["author"]
    assert_equal "1 cup rice", result["ingredients"].sole["item"]
    assert_equal({ "section" => "Finish", "text" => "Serve & enjoy." }, result["steps"].sole)
  end

  test "requires a title, ingredients and instructions with supported types" do
    [ { "name" => "" }, { "name" => "x" * 301 }, { "recipeIngredient" => [] }, { "recipeIngredient" => [ 123 ] },
      { "recipeInstructions" => nil }, { "recipeInstructions" => [] }, { "recipeInstructions" => [ "Mix.", { "url" => "https://example.com/video" } ] } ].each do |overrides|
      assert_nil extract(overrides), "Incomplete or unsupported core recipe data must not be saved"
    end
  end

  test "bounds ingredient and instruction sizes, counts and nesting" do
    assert_nil extract("recipeIngredient" => [ "x" * (RecipeText::MAX_INGREDIENT_LENGTH + 1) ])
    assert_nil extract("recipeIngredient" => Array.new(201, "rice"))
    assert_nil extract("recipeInstructions" => [ "x" * (RecipeText::MAX_STEP_LENGTH + 1) ])
    assert_nil extract("recipeInstructions" => Array.new(201, "Mix."))
    nested = "Mix."
    12.times { nested = { "itemListElement" => [ nested ] } }
    assert_nil extract("recipeInstructions" => nested)
  end
end
