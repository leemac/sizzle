require "test_helper"

class CooksControllerTest < ActionDispatch::IntegrationTest
  setup do
    @recipe = Recipe.create!(title: "Chickpea Curry")
  end

  test "marking a recipe as made logs the time and counts it" do
    freeze_time do
      post recipe_cooks_url(@recipe)

      assert_redirected_to recipe_url(@recipe)
      assert_equal 1, @recipe.reload.cooks_count
      assert_equal Time.current, @recipe.cooks.sole.cooked_at
    end
  end

  test "logging a cook isn't an edit" do
    post recipe_cooks_url(@recipe)

    assert_nil @recipe.reload.edited_at
  end

  test "undo removes that one logged time" do
    @recipe.cooked!(at: 3.days.ago)
    latest = @recipe.cooked!

    delete recipe_cook_url(@recipe, latest)

    assert_redirected_to recipe_url(@recipe)
    assert_equal 1, @recipe.reload.cooks_count
    assert_not Cook.exists?(latest.id)
  end

  test "can't undo another recipe's cook" do
    other = Recipe.create!(title: "Lentil Soup")
    cook = other.cooked!

    delete recipe_cook_url(@recipe, cook)

    assert_response :not_found
    assert Cook.exists?(cook.id)
    assert_equal 1, other.reload.cooks_count
  end

  test "unknown recipe is not found" do
    post recipe_cooks_url(recipe_id: 0)

    assert_response :not_found
  end

  test "marking as made keeps browser CSRF protection" do
    previous = ActionController::Base.allow_forgery_protection
    ActionController::Base.allow_forgery_protection = true
    cook = @recipe.cooked!

    post recipe_cooks_url(@recipe)
    assert_response :unprocessable_content
    delete recipe_cook_url(@recipe, cook)
    assert_response :unprocessable_content
    assert_equal [ cook ], @recipe.cooks.reload.to_a
  ensure
    ActionController::Base.allow_forgery_protection = previous
  end

  test "the recipe page shows how often and when it was made, without writing anything" do
    @recipe.cooked!(at: 3.days.ago)
    latest = @recipe.cooked!(at: 1.day.ago)

    assert_no_changes -> { [ @recipe.reload.updated_at, Cook.count ] } do
      get recipe_url(@recipe)
    end

    props = inertia.props[:recipe]
    assert_equal 2, props[:cooks_count]
    assert_equal({ "id" => latest.id, "cooked_at" => latest.cooked_at.iso8601 }, props[:last_cook])
    assert_nil props[:edited_at]
  end

  test "deleting a recipe deletes its cooks" do
    @recipe.cooked!

    assert_difference -> { Cook.count }, -1 do
      delete recipe_url(@recipe)
    end
  end
end
