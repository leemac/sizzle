require "test_helper"

class RecipeDraftTest < ActiveSupport::TestCase
  IMAGES = [
    PageScraper::Image.new(id: "img1", url: "https://cdn.example.com/hero.jpg", alt: nil, source: "schema.org"),
    PageScraper::Image.new(id: "img2", url: "https://cdn.example.com/step.jpg", alt: nil, source: "page")
  ].freeze

  def draft(images: IMAGES, **overrides)
    RecipeDraft.new(FakeExtractor.recipe(overrides), images:)
  end

  test "keeps a well-formed extraction as is" do
    attributes = draft.attributes

    assert_equal "Weeknight Chickpea Curry", attributes[:title]
    assert_equal 4, attributes[:servings]
    assert_equal "main", attributes[:course]
    assert_equal [ "vegan" ], attributes[:diets]
    assert_equal "chickpeas", attributes[:main_ingredient]
    assert_equal %w[weeknight one-pot], attributes[:tags]
    assert_equal "chickpeas", attributes[:ingredients].sole["item"]
    assert_equal "Simmer everything for 20 minutes.", attributes[:steps].sole["text"]
    assert Recipe.new(attributes).valid?
  end

  test "keeps known meal times and seasons, guessing meal times from the course when none are given" do
    attributes = draft("meal_times" => [ "dinner", "elevenses", 3, { "x" => 1 } ], "seasons" => [ "Winter", "monsoon", nil ]).attributes

    assert_equal %w[dinner], attributes[:meal_times]
    assert_equal %w[winter], attributes[:seasons]
    assert_equal %w[lunch dinner], draft.attributes[:meal_times]
    assert_equal %w[breakfast], draft("course" => "breakfast", "meal_times" => "breakfast").attributes[:meal_times]
    assert_empty draft("course" => "sauce").attributes[:meal_times]
    assert_empty draft("seasons" => %w[spring summer autumn winter]).attributes[:seasons]
    assert Recipe.new(attributes).valid?
  end

  test "is only a recipe when Claude says so and there's a title" do
    assert draft.recipe?
    assert_not draft("is_recipe" => false).recipe?
    assert_not draft("is_recipe" => "true").recipe?
    assert_not draft("title" => "   ").recipe?
    assert_not RecipeDraft.new("not a hash").recipe?
  end

  test "clamps overlong text so a hostile page can't make the save fail or bloat the database" do
    attributes = draft("title" => "T" * 5000, "description" => "D" * 50_000, "tags" => [ "x" * 500 ] * 3).attributes

    assert_equal 300, attributes[:title].length
    assert_equal 2000, attributes[:description].length
    assert_equal [ 40 ], attributes[:tags].map(&:length)
    assert Recipe.new(attributes).valid?
  end

  test "caps list sizes" do
    attributes = draft(
      "ingredients" => [ { "item" => "salt" } ] * 500,
      "steps" => [ { "text" => "Stir." } ] * 500,
      "tags" => (1..20).map { |n| "tag#{n}" },
      "tips" => [ "Tip." ] * 20
    ).attributes

    assert_equal RecipeDraft::MAX_INGREDIENTS, attributes[:ingredients].size
    assert_equal RecipeDraft::MAX_STEPS, attributes[:steps].size
    assert_equal RecipeDraft::MAX_TAGS, attributes[:tags].size
    assert_equal RecipeDraft::MAX_TIPS, attributes[:tips].size
  end

  test "drops values of the wrong type or out of range" do
    attributes = draft(
      "servings" => -2, "prep_minutes" => "10", "cook_minutes" => 10**9, "total_minutes" => 30.5,
      "course" => "brunch", "diets" => [ "vegan", 7, "carnivore" ], "cuisine" => { "name" => "Thai" },
      "ingredients" => [ "2 cups flour", { "item" => "" }, { "item" => "flour", "quantity" => Float::INFINITY, "unit" => 3 } ],
      "steps" => [ { "text" => nil }, "Stir.", { "text" => "Bake.", "section" => [ "x" ] } ]
    ).attributes

    assert_nil attributes[:servings]
    assert_nil attributes[:prep_minutes]
    assert_nil attributes[:cook_minutes]
    assert_nil attributes[:total_minutes]
    assert_nil attributes[:course]
    assert_nil attributes[:cuisine]
    assert_equal [ "vegan" ], attributes[:diets]
    assert_equal [ { "section" => nil, "quantity" => nil, "quantity_max" => nil, "unit" => nil, "item" => "flour",
                     "preparation" => nil, "note" => nil } ], attributes[:ingredients]
    assert_equal [ { "section" => nil, "text" => "Bake." } ], attributes[:steps]
  end

  test "only picks images from the scraped candidates" do
    images = draft("hero_image_id" => "img2", "step_image_ids" => [ "img1", "img2", "img9", "https://evil.example/x.jpg" ])

    assert_equal %w[https://cdn.example.com/step.jpg https://cdn.example.com/hero.jpg], images.cover_urls
    assert_equal [ "https://cdn.example.com/hero.jpg" ], images.photo_urls, "the cover isn't repeated as a step photo"
  end

  test "falls back to every candidate when the hero id is unknown" do
    assert_equal IMAGES.map(&:url), draft("hero_image_id" => "img42").cover_urls
    assert_empty draft(images: []).cover_urls
  end

  test "video metadata only comes from the fetched video, never from model output" do
    attributes = draft("video_metadata" => { "id" => YoutubeWatchPage::VIDEO_ID, "duration_seconds" => 200 }).attributes

    assert_equal({}, attributes[:video_metadata])
    [ nil, [], "video", { "id" => "not-an-id" } ].each do |video|
      assert_equal({}, RecipeDraft.new({}, video:).video_metadata)
    end
  end

  test "validates video duration, chapter ordering and plain text titles" do
    video = {
      "id" => YoutubeWatchPage::VIDEO_ID, "duration_seconds" => 300,
      "chapters" => [
        nil, "chapter", { "start_seconds" => -1, "title" => "Negative" },
        { "start_seconds" => "0", "title" => "String" },
        { "start_seconds" => 0, "title" => "<b>Intro</b><script>alert(1)</script>" },
        { "start_seconds" => 0, "title" => "Duplicate" },
        { "start_seconds" => 60, "title" => "T" * 1000 },
        { "start_seconds" => 45, "title" => "Backwards" },
        { "start_seconds" => 90, "title" => {} },
        { "start_seconds" => 300, "title" => "After the end" }
      ],
      "written_recipe_url" => "https://example.com/recipe"
    }
    metadata = RecipeDraft.new({}, video:).video_metadata

    assert_equal 300, metadata["duration_seconds"]
    assert_equal [ 0, 60 ], metadata["chapters"].pluck("start_seconds")
    assert_equal "Intro", metadata["chapters"].first["title"]
    assert_equal 200, metadata["chapters"].last["title"].length
    assert_equal "https://example.com/recipe", metadata["written_recipe_url"]
  end

  test "caps chapter count and rejects unreasonable video durations and unsafe written links" do
    video = { "id" => YoutubeWatchPage::VIDEO_ID,
              "chapters" => (0..100).map { |n| { "start_seconds" => n, "title" => "Part #{n}" } } }
    assert_equal RecipeDraft::MAX_VIDEO_CHAPTERS, RecipeDraft.new({}, video:).video_metadata["chapters"].size

    [ -1, 0, "30", Float::INFINITY, 10**12 ].each do |duration|
      assert_nil RecipeDraft.new({}, video: video.merge("duration_seconds" => duration)).video_metadata["duration_seconds"]
    end
    [ "javascript:alert(1)", "data:text/html,hello", "https:///recipe", "https://user:secret@example.com/recipe",
      "https://example.com/#{'x' * 2048}", {}, 123 ].each do |url|
      assert_nil RecipeDraft.new({}, video: video.merge("written_recipe_url" => url)).video_metadata["written_recipe_url"]
    end
  end
end
