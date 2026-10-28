require "test_helper"

class RecipeSerializerTest < ActiveSupport::TestCase
  VIDEO_ID = YoutubeWatchPage::VIDEO_ID
  WATCH_URL = "https://www.youtube.com/watch?v=#{VIDEO_ID}".freeze

  test "menu identity uses shared URL and content signatures" do
    original = Recipe.create!(title: "Crêpes", source_url: "https://www.example.com/crepes?utm_source=mail",
      ingredients: [ { "item" => "flour", "quantity" => "1" } ])
    copy = Recipe.create!(title: "CREPES", source_url: "http://m.example.com/crepes/print",
      ingredients: [ { "item" => "Flour", "quantity" => "2" } ])
    first = RecipeSerializer.menu(original)
    second = RecipeSerializer.menu(copy)

    assert_includes first[:signature_keys], "uid:#{original.uid}"
    assert_includes first[:signature_keys] & second[:signature_keys], "url:example.com|/crepes"
    assert_includes first[:signature_keys] & second[:signature_keys],
      "content:#{RecipeSignature.fingerprint(original.title, original.ingredients)}"
    assert_equal original.meal_times, first[:meal_times]
    assert_equal original.cooks_count, first[:cooks_count]
  end

  test "menu identity does not match recipes by title alone" do
    first = RecipeSerializer.menu(Recipe.create!(title: "Soup"))
    second = RecipeSerializer.menu(Recipe.create!(title: "Soup"))

    assert_empty first[:signature_keys] & second[:signature_keys]
    assert_equal 1, first[:signature_keys].size
  end

  test "surfaces canonical video links for existing imported and manually entered YouTube sources" do
    [ WATCH_URL, "https://youtu.be/#{VIDEO_ID}?si=share", "https://m.youtube.com/shorts/#{VIDEO_ID}" ].each do |url|
      recipe = Recipe.create!(title: "Video recipe", source_url: url)

      assert_equal WATCH_URL, RecipeSerializer.detail(recipe)[:youtube_url]
      assert_equal recipe.source_url, RecipeSerializer.detail(recipe)[:source_url]
    end
  end

  test "does not turn other sources or malformed video links into YouTube links" do
    [ nil, "https://example.com/recipe", "https://youtube.com.evil.example/watch?v=#{VIDEO_ID}",
      "https://evil.example/watch?v=#{VIDEO_ID}", "https://youtube.com/watch?v=invalid",
      "https://youtube.com/@cook" ].each do |url|
      recipe = Recipe.create!(title: "Recipe", source_url: url)

      assert_nil RecipeSerializer.detail(recipe)[:youtube_url], url.inspect
    end
  end

  test "video link follows changes to the recipe source" do
    recipe = Recipe.create!(title: "Video recipe", source_url: WATCH_URL)
    assert_equal WATCH_URL, RecipeSerializer.detail(recipe)[:youtube_url]

    recipe.update!(source_url: "https://example.com/recipe")
    assert_nil RecipeSerializer.detail(recipe)[:youtube_url]
  end

  test "surfaces captured video metadata and builds chapter links from the source video" do
    recipe = Recipe.create!(title: "Video recipe", source_url: WATCH_URL, video_metadata: {
      "id" => VIDEO_ID, "duration_seconds" => 300, "written_recipe_url" => "https://example.com/recipe",
      "chapters" => [ { "start_seconds" => 90, "title" => "Simmer" } ]
    })
    detail = RecipeSerializer.detail(recipe)

    assert_equal 300, detail[:youtube_duration_seconds]
    assert_equal "https://example.com/recipe", detail[:written_recipe_url]
    assert_equal [ { "start_seconds" => 90, "title" => "Simmer", "url" => "#{WATCH_URL}&t=90s" } ], detail[:youtube_chapters]

    recipe.update!(source_url: "https://youtube.com/watch?v=AAAAAAAAAAA")
    detail = RecipeSerializer.detail(recipe)
    assert_equal "https://www.youtube.com/watch?v=AAAAAAAAAAA", detail[:youtube_url]
    assert_nil detail[:youtube_duration_seconds]
    assert_nil detail[:written_recipe_url]
    assert_empty detail[:youtube_chapters]
  end
end
