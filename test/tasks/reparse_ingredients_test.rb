require "test_helper"
require "rake"

class ReparseIngredientsTest < ActiveSupport::TestCase
  setup do
    Rails.application.load_tasks unless Rake::Task.task_defined?("sizzle:reparse_ingredients")
    @task = Rake::Task["sizzle:reparse_ingredients"]
    @previous_apply = ENV["APPLY"]
    @plain = { "section" => "Sauce", "quantity" => nil, "quantity_max" => nil, "unit" => nil,
               "item" => "2 cups flour (Note 123456)", "preparation" => nil, "note" => nil }
    @structured = RecipeText.ingredient("3 eggs")
    @recipe = Recipe.create!(title: "Backfill example", ingredients: [ @plain, @structured ])
  end

  teardown do
    ENV["APPLY"] = @previous_apply
  end

  def run_task(apply = nil)
    ENV["APPLY"] = apply
    @task.reenable
    capture_io { @task.invoke }.first
  end

  test "defaults to a dry run with before and after per recipe" do
    before = @recipe.attributes
    output = run_task
    assert_includes output, "Dry run"
    assert_includes output, "Recipe #{@recipe.id}"
    assert_includes output, "→"
    assert_equal before, @recipe.reload.attributes
    run_task("true")
    assert_equal before, @recipe.reload.attributes
  end

  test "apply preserves structured ingredients and sections and is idempotent" do
    run_task("1")
    assert_equal [ 2, "cup", "flour", "Sauce" ], @recipe.reload.ingredients.first.values_at("quantity", "unit", "item", "section")
    assert_equal @structured, @recipe.ingredients.last
    before = @recipe.attributes
    assert_not_includes run_task("1"), "Recipe #{@recipe.id}:"
    assert_equal before, @recipe.reload.attributes
  end

  test "normalization and length caps do not require a second pass" do
    @recipe.update!(ingredients: [ @plain.merge("item" => "\u200b2 cups flour"),
                                   @plain.merge("item" => "2 cups " + ("x" * 2100)) ])
    run_task("1")
    before = @recipe.reload.attributes
    assert_not_includes run_task("1"), "Recipe #{@recipe.id}:"
    assert_equal before, @recipe.reload.attributes
  end

  test "any structured field prevents changes" do
    %w[quantity quantity_max unit preparation note].each do |field|
      ingredient = @plain.merge(field => (%w[quantity quantity_max].include?(field) ? 1 : "some"))
      @recipe.update!(ingredients: [ ingredient ])
      run_task("1")
      assert_equal [ ingredient ], @recipe.reload.ingredients
    end
  end

  test "apply refreshes the search index through model callbacks" do
    assert_includes Recipe.search("123456"), @recipe
    run_task("1")
    assert_not_includes Recipe.search("123456"), @recipe
    assert_includes Recipe.search("flour"), @recipe
  end
end
