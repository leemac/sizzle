require "test_helper"

class RecipeEditTest < ActiveSupport::TestCase
  INGREDIENTS = [
    { "section" => nil, "quantity" => 1.5, "quantity_max" => nil, "unit" => "cup", "item" => "basmati rice",
      "preparation" => "rinsed", "note" => nil },
    { "section" => "For the sauce", "quantity" => 2, "quantity_max" => 3, "unit" => "tbsp", "item" => "curry paste",
      "preparation" => nil, "note" => "or more to taste" },
    { "section" => "For the sauce", "quantity" => nil, "quantity_max" => nil, "unit" => nil, "item" => "salt",
      "preparation" => nil, "note" => nil }
  ].freeze

  setup do
    @recipe = Recipe.create!(
      title: "Chickpea Curry", source_url: "https://example.com/curry", source_name: "Example Kitchen",
      ingredients: INGREDIENTS, steps: [ { "section" => nil, "text" => "Cook the rice." },
                                         { "section" => "Sauce", "text" => "Simmer the paste." } ],
      tips: [ "Freezes well." ], prep_minutes: 10, cook_minutes: 30, total_minutes: 50, servings: 4
    )
  end

  def edit(**changes)
    form = RecipeEdit.for(@recipe)
    RecipeEdit.new(@recipe, form.attributes.merge(changes.stringify_keys))
  end

  test "shows ingredients and steps as lines with section headings" do
    form = RecipeEdit.for(@recipe)

    assert_equal "1½ cups basmati rice, rinsed\n# For the sauce\n2–3 tbsp curry paste (or more to taste)\nsalt", form.ingredients
    assert_equal "Cook the rice.\n# Sauce\nSimmer the paste.", form.steps
    assert_equal "Freezes well.", form.tips
    assert_equal "50", form.total_minutes
  end

  test "saving without changes keeps every field as it was" do
    before = @recipe.attributes.except("updated_at")
    assert edit.save

    assert_equal before, @recipe.reload.attributes.except("updated_at")
  end

  test "an edited line becomes plain text while unchanged lines keep their structure" do
    assert edit(ingredients: "2 cups jasmine rice\n# For the sauce\n2–3 tbsp curry paste (or more to taste)\nsalt").save

    rice, paste, salt = @recipe.reload.ingredients
    assert_equal RecipeText.ingredient("2 cups jasmine rice"), rice
    assert_equal INGREDIENTS[1], paste
    assert_equal INGREDIENTS[2], salt
  end

  test "moving a line under another heading changes its section" do
    assert edit(ingredients: "# Rice\n1½ cups basmati rice, rinsed\n# Sauce\n2–3 tbsp curry paste (or more to taste)\nsalt").save

    assert_equal [ "Rice", "Sauce", "Sauce" ], @recipe.reload.ingredients.map { |line| line["section"] }
    assert_equal 1.5, @recipe.ingredients.first["quantity"]
  end

  test "a hash without a space isn't a heading" do
    assert edit(ingredients: "#10 can tomatoes\n# \nsalt").save

    assert_equal [ [ nil, "#10 can tomatoes" ], [ nil, "salt" ] ], @recipe.reload.ingredients.map { |line| line.values_at("section", "item") }
  end

  test "headings alone don't count as ingredients or steps" do
    form = edit(ingredients: "# Sauce", steps: "# Method")

    assert_not form.save
    assert form.errors[:ingredients].any?
    assert form.errors[:steps].any?
  end

  test "an empty total adds up prep and cook" do
    assert edit(prep_minutes: "15", total_minutes: "").save
    assert_equal 45, @recipe.reload.total_minutes

    assert edit(prep_minutes: "", total_minutes: "").save
    assert_nil @recipe.reload.total_minutes
  end

  test "filter details are cleaned and course must be known" do
    assert edit(cuisine: " <b>Thai</b> ", main_ingredient: "Chickpeas", course: "main").save
    assert_equal [ "Thai", "chickpeas", "main" ], @recipe.reload.values_at(:cuisine, :main_ingredient, :course)

    assert edit(course: "").save
    assert_nil @recipe.reload.course

    form = edit(course: "brunch")
    assert_not form.save
    assert form.errors[:course].any?
  end

  test "rejects oversized notes and tips" do
    assert_not edit(notes: "x" * 10_001).save
    assert_not edit(tips: "x" * 1001).save
    assert_not edit(tips: Array.new(201, "tip").join("\n")).save
  end

  test "the source link can stay, but can't be a script or another recipe's link" do
    Recipe.create!(title: "Other", source_url: "https://example.com/other")

    assert edit(source_url: "https://example.com/curry").save
    assert_equal "Example Kitchen", @recipe.reload.source_name

    form = edit(source_url: "https://example.com/other")
    assert_not form.save
    assert_includes form.errors[:source_url], "is already in your cookbook"

    assert_not edit(source_url: "javascript:alert(1)").save
    assert_equal "https://example.com/curry", @recipe.reload.source_url
  end

  test "a new source link drops the old site name, and the link can be removed" do
    assert edit(source_url: "https://another.example.org/curry").save
    assert_equal [ "another.example.org", nil ], @recipe.reload.values_at(:source_host, :source_name)

    assert edit(source_url: "").save
    assert_equal [ nil, nil ], @recipe.reload.values_at(:source_url, :source_host)
  end
end
