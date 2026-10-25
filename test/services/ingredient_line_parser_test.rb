require "test_helper"
require_relative "../support/ingredient_line_cases"

class IngredientLineParserTest < ActiveSupport::TestCase
  test "parses the cookbook examples and round trips through the edit renderer" do
    IngredientLineCases::CASES.each do |line, *expected|
      parsed = RecipeText.ingredient(line)
      assert_equal expected, parsed.values_at("quantity", "quantity_max", "unit", "item", "preparation", "note"), line
      assert_equal parsed, RecipeText.ingredient(RecipeEdit.ingredient_line(parsed)), line
    end
  end

  test "accepts decimals ranges spaced unicode and known units only" do
    { "1 and 1/2 cups flour" => [ 1.5, nil, "cup", "flour" ],
      "1  ½ cups milk" => [ 1.5, nil, "cup", "milk" ],
      "1 ½ cups milk" => [ 1.5, nil, "cup", "milk" ],
      ".5 to 1.25 l water" => [ 0.5, 1.25, "l", "water" ],
      "2 large eggs" => [ 2, nil, nil, "large eggs" ],
      "2 scoops flour" => [ 2, nil, nil, "scoops flour" ],
      "3 pinches salt" => [ 3, nil, "pinch", "salt" ],
      "2 bunches herbs" => [ 2, nil, "bunch", "herbs" ] }.each do |line, expected|
      assert_equal expected, RecipeText.ingredient(line).values_at("quantity", "quantity_max", "unit", "item"), line
    end
  end

  test "edit rendering preserves precise quantities rather than rounding them" do
    [ "0.01 g spice", "1.49 cups flour", "0.00001 g salt", "⅐ cup water", "1⅓ cups rice", "2 mg salt", "1 (14 oz) can tomatoes", "1-1 cup water" ].each do |line|
      parsed = RecipeText.ingredient(line)
      assert_equal parsed, RecipeText.ingredient(RecipeEdit.ingredient_line(parsed)), line
    end
  end

  test "ambiguous or incomplete lines fall back without losing text" do
    [ "1 cup", "1/0 cup flour", "1-2/0 cups rice", "2-inch ginger", "7up soda", "3–2 eggs",
      "1 / sauce", "1 cup flour (sifted", "1 cup flour)", "(optional) 2 cups flour", "100001 g rice", "1.2.3 cups rice" ].each do |line|
      result = RecipeText.ingredient(line)
      assert_equal line, result["item"]
      assert_nil result["quantity"], line
    end
  end

  test "notes flatten brackets and omit only footnote pointers" do
    parsed = RecipeText.ingredient("2 cups flour ((sifted)) (Note 1) (Note 2 for swaps)")
    assert_equal "sifted; Note 2 for swaps", parsed["note"]
    assert_equal "flour", parsed["item"]
  end

  test "all plain text paths use draft caps and preserve nonempty items" do
    result = RecipeText.ingredient("2 cups flour, #{'x' * 400} (#{'y' * 500})")
    assert_nil RecipeText.ingredient("\u200b")
    assert_equal 2, RecipeText.ingredient("\u200b2 cups flour")["quantity"]
    assert_equal 200, result["preparation"].length
    assert_equal 300, result["note"].length
    assert_equal RecipeText::MAX_INGREDIENT_LENGTH, RecipeText.ingredient("x" * 2100)["item"].length
    assert_equal "1 cup", RecipeText.ingredient("1 cup")["item"]
    assert_equal '<img src="https://example.com">', RecipeText.ingredient('<img src="https://example.com">')["item"]
  end

  test "maximum length hostile lines parse within a generous time budget" do
    lines = [ ("(" * 1000) + (")" * 1000), ("9" * 1999) + "/", "1 " + ("(" * 1998), "1 " + (" " * 1997) + "½" ]
    started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    100.times { lines.each { |line| RecipeText.ingredient(line) } }
    assert_operator Process.clock_gettime(Process::CLOCK_MONOTONIC) - started, :<, 2
  end
end
