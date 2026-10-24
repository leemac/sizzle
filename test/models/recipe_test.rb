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
end
