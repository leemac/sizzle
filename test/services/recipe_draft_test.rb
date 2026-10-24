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
end
