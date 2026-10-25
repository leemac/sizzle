require "test_helper"

class SourceMetadataTest < ActiveSupport::TestCase
  test "metadata is bounded plain text and rejects unexpected types" do
    page = Struct.new(:title, :site_name, :description).new(
      "<script>alert(1)</script><b>Recipe</b>" + ("x" * 500),
      { "html" => "bad" }, "<img src=x onerror=alert(1)>  A\n description " + ("y" * 1000)
    )
    metadata = RecipeDraft.source_metadata(page)

    assert_equal 300, metadata.fetch("title").length
    assert_equal 500, metadata.fetch("description").length
    assert_not_includes metadata.fetch("title"), "<"
    assert_not_includes metadata.fetch("title"), "alert"
    assert_not_includes metadata.fetch("description"), "<"
    assert_not metadata.key?("site_name")
  end

  test "empty metadata stays empty" do
    page = Struct.new(:title, :site_name, :description).new(nil, " ", nil)
    assert_empty RecipeDraft.source_metadata(page)
  end

  test "changing a recipe source clears metadata from the previous page" do
    recipe = Recipe.create!(title: "Recipe", source_url: "https://example.com/one",
                            source_metadata: { "title" => "First page" })
    recipe.update!(source_url: "https://example.com/two")
    assert_empty recipe.reload.source_metadata
    assert_empty RecipeSerializer.detail(recipe)[:source_metadata]
  end
end
