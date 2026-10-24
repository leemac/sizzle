require "test_helper"

class RecipeEditsTest < ActionDispatch::IntegrationTest
  include ActiveJob::TestHelper

  setup do
    @recipe = Recipe.create!(title: "Chickpea Curry", course: "main", cuisine: "Indian", diets: [ "vegan" ],
                             source_url: "https://example.com/curry",
                             ingredients: [ { "item" => "chickpeas", "quantity" => 1 } ], steps: [ { "text" => "Simmer." } ])
  end

  def fields(**changes)
    { title: "Chickpea curry", ingredients: "1 chickpeas\n1 can coconut milk", steps: "Simmer.",
      cuisine: "Indian", course: "main", notes: "Add more ginger." }.merge(changes)
  end

  def inertia_headers
    { "X-Inertia" => "true", "X-Inertia-Version" => ViteRuby.digest }
  end

  test "edit page starts from the recipe's current details" do
    get edit_recipe_url(@recipe)

    assert_response :success
    assert_equal "recipes/edit", inertia.component
    form = inertia.props[:recipe]
    assert_equal @recipe.id, form[:id]
    assert_equal "Chickpea Curry", form[:fields]["title"]
    assert_equal "1 chickpeas", form[:fields]["ingredients"]
    assert_equal "", form[:fields]["servings"]
    assert_equal Recipe::COURSES, form[:courses]
  end

  test "saving changes updates the recipe and its search entry" do
    assert_no_enqueued_jobs do
      patch recipe_url(@recipe), params: { recipe: fields }
    end

    assert_redirected_to recipe_url(@recipe)
    @recipe.reload
    assert_equal "Chickpea curry", @recipe.title
    assert_equal [ "chickpeas", "1 can coconut milk" ], @recipe.ingredients.map { |line| line["item"] }
    assert_equal "Add more ginger.", @recipe.notes
    assert_equal [ @recipe ], Recipe.search("coconut").to_a
    follow_redirect!(headers: inertia_headers)
    assert_equal "Add more ginger.", inertia.props[:recipe][:notes]
  end

  test "invalid changes return field errors and change nothing" do
    patch recipe_url(@recipe), params: { recipe: fields(title: " ", course: "brunch", servings: "-2") }

    assert_redirected_to edit_recipe_url(@recipe)
    follow_redirect!(headers: inertia_headers)
    assert inertia.props[:errors]["title"]
    assert inertia.props[:errors]["course"]
    assert inertia.props[:errors]["servings"]
    assert_equal "Chickpea Curry", @recipe.reload.title
  end

  test "stores text without HTML and ignores fields that aren't on the form" do
    patch recipe_url(@recipe), params: { recipe: fields(
      title: "<b>Curry &amp; rice</b>", steps: "<script>bad()</script><p>Simmer.</p>",
      notes: '<img src="http://169.254.169.254/">Less salt',
      archived_at: Time.current, rating: 5, source_name: "Spoofed", diets: [ "vegetarian" ], id: 999
    ) }

    @recipe.reload
    assert_equal "Curry & rice", @recipe.title
    assert_equal "Simmer.", @recipe.steps.sole["text"]
    assert_equal "Less salt", @recipe.notes
    assert_not @recipe.archived?
    assert_nil @recipe.rating
    assert_nil @recipe.source_name
    assert_equal [ "vegan" ], @recipe.diets
  end

  test "updating needs the recipe params" do
    patch recipe_url(@recipe), params: { title: "Loose param" }

    assert_response :bad_request
    assert_equal "Chickpea Curry", @recipe.reload.title
  end

  test "archiving hides a recipe from the gallery, facets, counts and search" do
    Recipe.create!(title: "Apple Pie", course: "dessert")
    @recipe.favorite!

    post recipe_archive_url(@recipe)
    assert_redirected_to root_url
    assert @recipe.reload.archived?

    get root_url
    assert_equal [ "Apple Pie" ], inertia.props[:recipes].map { |recipe| recipe[:title] }
    assert_equal 1, inertia.props[:total_count]
    assert_equal [ "dessert" ], inertia.props[:facets]["courses"].map { |facet| facet["value"] }
    assert_empty inertia.props[:facets]["cuisines"]
    assert_empty inertia.props[:facets]["diets"]
    assert_equal 0, inertia.props[:facets]["favorites"]

    get root_url, params: { favorites: "1" }
    assert_empty inertia.props[:recipes]

    get root_url, params: { q: "chickpea" }
    assert_empty inertia.props[:recipes]
  end

  test "an archived recipe is kept and still opens by its link" do
    post recipe_archive_url(@recipe)

    get recipe_url(@recipe)
    assert_response :success
    assert inertia.props[:recipe][:archived]
    assert_equal [ @recipe ], Recipe.archived.to_a
  end

  test "archiving again keeps the original archive time" do
    @recipe.archive!
    archived_at = @recipe.archived_at

    travel 1.day do
      post recipe_archive_url(@recipe)
    end
    assert_equal archived_at, @recipe.reload.archived_at
  end
end
