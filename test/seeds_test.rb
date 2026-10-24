require "test_helper"

class SeedsTest < ActiveSupport::TestCase
  test "loads a complete offline cookbook and preserves it on subsequent runs" do
    seed_recipes
    recipes = Recipe.where(author: "Sizzle sample kitchen")
    assert_equal 21, recipes.count
    assert_equal 9, recipes.distinct.count(:course)

    recipes.each do |recipe|
      assert recipe.valid?, recipe.errors.full_messages.join(", ")
      assert recipe.cover.attached?, recipe.title
      assert_equal "image/webp", recipe.cover.blob.content_type
      assert_operator recipe.ingredients.length, :>=, 5
      assert_operator recipe.steps.length, :>=, 3
      assert recipe.description.present?
      assert recipe.tips.any?
    end

    cookies = recipes.find_by!(title: "Chocolate chunk cookies with flaky salt")
    assert_nil cookies.servings
    assert_equal "Makes 16 cookies", cookies.yield_text
    salad = recipes.find_by!(main_ingredient: "chickpeas", course: "salad")
    assert_equal 0, salad.cook_minutes
    assert salad.ingredients.any? { |ingredient| ingredient["quantity_max"] }

    recipe = recipes.first
    recipe.update!(description: "My edited recipe", notes: "Use less salt", rating: 4)
    ids = recipes.order(:id).pluck(:id)
    blobs = ActiveStorage::Blob.order(:id).pluck(:id)

    assert_no_difference "Recipe.count" do
      seed_recipes
    end
    assert_equal ids, recipes.order(:id).pluck(:id)
    assert_equal blobs, ActiveStorage::Blob.order(:id).pluck(:id)
    assert_equal "My edited recipe", recipe.reload.description
    assert_equal "Use less salt", recipe.notes
    assert_equal 4, recipe.rating
  end

  test "drinks can be browsed by course and searched by their ingredients and tags" do
    seed_recipes

    drinks = Recipe.filter_by(course: "drink")
    assert_equal 6, drinks.count
    assert_equal 2, Recipe.search("mocktail").count
    assert_equal [ "Hibiscus iced tea with lemon" ], Recipe.search("hibiscus").pluck(:title)
    assert_equal [ "Vanilla iced coffee" ], drinks.where(main_ingredient: "coffee").pluck(:title)
    assert_equal 4, drinks.count { |drink| drink.tags.include?("caffeine-free") }

    tea = drinks.find_by!(main_ingredient: "hibiscus")
    assert tea.tags.include?("make-ahead")
    assert_operator tea.total_minutes, :>, tea.prep_minutes + tea.cook_minutes
    assert tea.ingredients.any? { |ingredient| ingredient["quantity_max"] }
  end

  test "upgrades the original placeholders in place" do
    legacy = Recipe.create!(
      title: "Weeknight Chickpea Curry",
      source_url: "https://example.com/weeknight-chickpea-curry",
      source_name: "Example Kitchen",
      description: "A sample recipe so you can see how Sizzle looks before importing your own."
    )
    legacy.cover.attach(io: StringIO.new(sample_jpeg), filename: "cover.jpg", content_type: "image/jpeg")

    seed_recipes

    assert_equal "Coconut vegetable korma", legacy.reload.title
    assert_equal "Sizzle sample kitchen", legacy.author
    assert_nil legacy.source_url
    assert_nil legacy.source_host
    assert_equal "curry.webp", legacy.cover.filename.to_s
    assert_equal 21, Recipe.where(author: "Sizzle sample kitchen").count
  end

  test "preserves imported recipes and annotated placeholders" do
    imported = Recipe.create!(title: "Margherita pizza", source_url: "https://example.org/my-pizza", notes: "Mine")
    legacy = Recipe.create!(
      title: "Weeknight Chickpea Curry",
      source_url: "https://example.com/weeknight-chickpea-curry",
      source_name: "Example Kitchen",
      description: "A sample recipe so you can see how Sizzle looks before importing your own.",
      notes: "Keep my changes"
    )

    seed_recipes

    assert_equal "Mine", imported.reload.notes
    assert_equal "https://example.org/my-pizza", imported.source_url
    assert_not imported.cover.attached?
    assert_equal "Weeknight Chickpea Curry", legacy.reload.title
    assert_equal "Keep my changes", legacy.notes
    assert_equal 1, Recipe.where(title: imported.title).count
  end

  test "does not populate environments outside development by default" do
    skip "SEED_ANYWAY explicitly permits seeding" if ENV["SEED_ANYWAY"]

    assert_no_difference "Recipe.count" do
      load Rails.root.join("db/seeds.rb")
    end
  end

  private

  def seed_recipes
    previous = ENV["SEED_ANYWAY"]
    ENV["SEED_ANYWAY"] = "1"
    capture_io { load Rails.root.join("db/seeds.rb") }
  ensure
    ENV["SEED_ANYWAY"] = previous
  end
end
