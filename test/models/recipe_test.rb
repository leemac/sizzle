require "test_helper"

class RecipeTest < ActiveSupport::TestCase
  def create_recipe(**attributes)
    Recipe.create!(title: "Recipe", **attributes)
  end

  test "normalizes source URLs by dropping tracking parameters and fragments" do
    recipe = create_recipe(source_url: "https://WWW.Example.com/pie?utm_source=ig&id=3&fbclid=abc#comments")

    assert_equal "https://www.example.com/pie?id=3", recipe.source_url
    assert_equal "example.com", recipe.source_host
  end

  test "full-text search matches title, ingredients and tags with prefix matching" do
    curry = create_recipe(title: "Chickpea Curry", ingredients: [ { "item" => "coconut milk" } ], tags: [ "weeknight" ])
    create_recipe(title: "Apple Pie", ingredients: [ { "item" => "apples" } ])

    assert_equal [ curry ], Recipe.search("chick").to_a
    assert_equal [ curry ], Recipe.search("coconut").to_a
    assert_equal [ curry ], Recipe.search("weeknight").to_a
  end

  test "search treats FTS syntax in user input as plain words" do
    create_recipe(title: "Chickpea Curry")

    assert_nothing_raised { Recipe.search('chick" OR title:* NEAR( -').to_a }
    assert_empty Recipe.search('"* -').to_a
  end

  test "search index follows updates and deletes" do
    recipe = create_recipe(title: "Lemon Bars")
    recipe.update!(title: "Lime Bars")

    assert_empty Recipe.search("lemon")
    assert_equal [ recipe ], Recipe.search("lime").to_a

    recipe.destroy!
    assert_empty Recipe.search("lime")
  end

  test "filters by course, cuisine, diet, main ingredient and time" do
    quick = create_recipe(course: "main", cuisine: "Thai", diets: [ "vegan" ], main_ingredient: "tofu", total_minutes: 25)
    create_recipe(course: "dessert", cuisine: "French", diets: [], total_minutes: 90)

    assert_equal [ quick ], Recipe.filter_by(course: "main").to_a
    assert_equal [ quick ], Recipe.filter_by(cuisine: "Thai").to_a
    assert_equal [ quick ], Recipe.filter_by(diet: "vegan").to_a
    assert_equal [ quick ], Recipe.filter_by(main: "tofu").to_a
    assert_equal [ quick ], Recipe.filter_by(max_minutes: "30").to_a
    assert_equal 2, Recipe.filter_by(nonsense: "x").count
  end

  test "favorites can be added, removed and filtered" do
    favorite = create_recipe(title: "Lemon Bars")
    create_recipe(title: "Apple Pie")

    favorite.favorite!
    assert favorite.favorite?
    assert_equal [ favorite ], Recipe.filter_by(favorites: "1").to_a
    assert_equal 2, Recipe.filter_by(favorites: "0").count
    assert_equal 1, Recipe.facets[:favorites]

    favorite.unfavorite!
    assert_not favorite.reload.favorite?
    assert_empty Recipe.filter_by(favorites: "1")
  end

  test "facets count each value" do
    create_recipe(course: "main", diets: [ "vegan" ])
    create_recipe(course: "main", diets: [ "vegan", "gluten-free" ])

    facets = Recipe.facets
    assert_equal [ { value: "main", count: 2 } ], facets[:courses]
    assert_equal({ value: "vegan", count: 2 }, facets[:diets].first)
  end

  test "rejects unknown courses and diets" do
    assert_not Recipe.new(title: "x", course: "brunch-ish").valid?
    assert_not Recipe.new(title: "x", diets: [ "carnivore" ]).valid?
  end

  test "rejects source URLs that aren't http(s)" do
    assert_not Recipe.new(title: "x", source_url: "javascript:alert(1)").valid?
    assert_not Recipe.new(title: "x", source_url: "data:text/html,hi").valid?
    assert Recipe.new(title: "x", source_url: "https://example.com/pie").valid?
  end

  test "rejects unsafe written recipe links even outside the import pipeline" do
    [ "javascript:alert(1)", "data:text/html,hello", "https:///recipe", "https://user:secret@example.com/recipe",
      "https://example.com/#{'x' * 2048}", {}, 123 ].each do |url|
      assert_not Recipe.new(title: "Recipe", video_metadata: { "written_recipe_url" => url }).valid?, url.inspect
    end
    assert_not Recipe.new(title: "Recipe", video_metadata: []).valid?
    assert Recipe.new(title: "Recipe", video_metadata: { "written_recipe_url" => "https://example.com/recipe" }).valid?
  end

  test "filters by meal time, with this season's recipes ahead of all-year ones" do
    all_year = create_recipe(title: "Toasted sandwich", meal_times: %w[lunch], created_at: 1.day.ago)
    autumn = create_recipe(title: "Squash soup", meal_times: %w[lunch dinner], seasons: %w[autumn winter], created_at: 2.days.ago)
    create_recipe(title: "Berry salad", meal_times: %w[lunch], seasons: %w[summer])
    create_recipe(title: "Porridge", meal_times: %w[breakfast], seasons: %w[autumn])
    create_recipe(title: "Old soup", meal_times: %w[lunch], archived_at: Time.current)

    assert_equal [ autumn, all_year ], Recipe.filter_by(meal: "lunch", season: "autumn").to_a
    assert_equal 3, Recipe.filter_by(meal: "lunch").count
    assert_empty Recipe.filter_by(meal: "lunch'; DROP TABLE recipes; --")
    assert_equal [ { value: "breakfast", count: 1 }, { value: "lunch", count: 3 }, { value: "dinner", count: 1 } ],
                 Recipe.facets[:meal_times]
    assert_equal Recipe::SEASONS, Recipe.facets[:seasons]
  end

  test "rejects unknown meal times and seasons" do
    assert_not Recipe.new(title: "x", meal_times: [ "elevenses" ]).valid?
    assert_not Recipe.new(title: "x", seasons: [ "monsoon" ]).valid?
    assert_not Recipe.new(title: "x", seasons: "summer").valid?
    assert Recipe.new(title: "x", meal_times: %w[lunch dinner], seasons: %w[winter]).valid?
  end

  test "reads seasons from free text, treating all four as all year" do
    assert_equal %w[summer autumn], Recipe.seasons_from([ "Fall", " summer ", "grilling", 3, nil ])
    assert_empty Recipe.seasons_from(%w[spring summer autumn winter])
    assert_equal %w[lunch dinner], Recipe.meal_times_for_course("main")
    assert_empty Recipe.meal_times_for_course("sauce")
  end
end
