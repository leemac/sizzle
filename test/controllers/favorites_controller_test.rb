require "test_helper"

class FavoritesControllerTest < ActionDispatch::IntegrationTest
  setup do
    @recipe = Recipe.create!(title: "Chickpea Curry")
  end

  test "favoriting a recipe returns to the page it came from" do
    post recipe_favorite_url(@recipe), headers: { "Referer" => root_url }

    assert_redirected_to root_url
    assert @recipe.reload.favorite?
  end

  test "favoriting twice keeps the original time" do
    @recipe.update!(favorited_at: 2.days.ago)

    assert_no_changes -> { @recipe.reload.favorited_at } do
      post recipe_favorite_url(@recipe)
    end
    assert_redirected_to recipe_url(@recipe)
  end

  test "unfavoriting a recipe" do
    @recipe.favorite!

    delete recipe_favorite_url(@recipe)

    assert_redirected_to recipe_url(@recipe)
    assert_not @recipe.reload.favorite?
  end

  test "ignores an off-site referer" do
    post recipe_favorite_url(@recipe), headers: { "Referer" => "https://evil.example/" }

    assert_redirected_to recipe_url(@recipe)
  end

  test "unknown recipe is not found" do
    post recipe_favorite_url(recipe_id: 0)

    assert_response :not_found
  end

  test "gallery cards and the recipe page say whether a recipe is a favorite" do
    @recipe.favorite!

    get recipe_url(@recipe)
    assert inertia.props[:recipe][:favorite]

    get root_url
    assert inertia.props[:recipes].sole[:favorite]
    assert_equal 1, inertia.props[:facets]["favorites"]
  end
end
