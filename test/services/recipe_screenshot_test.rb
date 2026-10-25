require "test_helper"

class RecipeScreenshotTest < ActiveSupport::TestCase
  PNG = "\x89PNG\r\n\x1A\n".b + "screenshot".b

  def upload(bytes = PNG, type: "image/png")
    file = Tempfile.new([ "screenshot", ".png" ], binmode: true)
    file.write(bytes)
    file.rewind
    ActionDispatch::Http::UploadedFile.new(tempfile: file, filename: "screenshot.png", type:)
  end

  def invalid_message(uploads, extractor = FakeExtractor.new)
    assert_raises(RecipeScreenshot::Invalid) { RecipeScreenshot.new(uploads, extractor:).fields }.message
  end

  test "sends the screenshots to Claude and returns the form's plain fields" do
    extractor = FakeExtractor.new(FakeExtractor.recipe(
      "ingredients" => [
        { "section" => nil, "quantity" => 1.5, "quantity_max" => nil, "unit" => "cup", "item" => "chickpeas",
          "preparation" => "drained", "note" => nil },
        { "section" => "For the sauce", "quantity" => 400, "quantity_max" => nil, "unit" => "ml",
          "item" => "coconut milk", "preparation" => nil, "note" => nil }
      ],
      "meal_times" => [ "dinner" ], "seasons" => [ "winter" ]
    ))

    fields = RecipeScreenshot.new([ upload, upload ], extractor:).fields

    assert_equal 2, extractor.screenshots.sole.size
    assert_equal "image/png", extractor.screenshots.sole.first.media_type
    assert_equal PNG, extractor.screenshots.sole.first.bytes
    assert_equal({
      title: "Weeknight Chickpea Curry", description: "A quick coconut chickpea curry.",
      ingredients: "1½ cups chickpeas, drained\n# For the sauce\n400 ml coconut milk",
      steps: "Simmer everything for 20 minutes.", servings: "4", prep_minutes: "10", cook_minutes: "20",
      meal_times: [ "dinner" ], seasons: [ "winter" ]
    }, fields)
  end

  test "method sections survive filling the form and saving it" do
    extractor = FakeExtractor.new(FakeExtractor.recipe("steps" => [
      { "section" => "For the sauce", "text" => "Simmer the tomatoes." },
      { "section" => "For the sauce", "text" => "Season to taste." },
      { "section" => "To finish", "text" => "Spoon over the chicken." }
    ]))

    fields = RecipeScreenshot.new([ upload ], extractor:).fields
    form = ManualRecipe.new(fields)

    assert form.save, form.errors.full_messages.to_sentence
    assert_equal [ [ "For the sauce", "Simmer the tomatoes." ], [ "For the sauce", "Season to taste." ],
                   [ "To finish", "Spoon over the chicken." ] ],
                 form.recipe.steps.map { |step| step.values_at("section", "text") }
  end

  test "a partial recipe fills what it can and leaves the rest blank" do
    extractor = FakeExtractor.new(FakeExtractor.recipe(
      "title" => "", "description" => nil, "servings" => nil, "prep_minutes" => nil, "cook_minutes" => nil,
      "ingredients" => [], "course" => nil, "meal_times" => []
    ))

    fields = RecipeScreenshot.new([ upload ], extractor:).fields

    assert_equal "Simmer everything for 20 minutes.", fields[:steps]
    assert_equal [ "", "", "", "", "", "" ], fields.values_at(:title, :description, :ingredients, :servings, :prep_minutes, :cook_minutes)
  end

  test "Claude's answer is validated like any extraction" do
    extractor = FakeExtractor.new(FakeExtractor.recipe(
      "title" => "x" * 500, "servings" => -3, "prep_minutes" => "ten", "meal_times" => [ "brunch" ],
      "seasons" => [ "monsoon" ], "steps" => [ 123, { "text" => "<b>Stir.</b>" } ]
    ))

    fields = RecipeScreenshot.new([ upload ], extractor:).fields

    assert_equal 300, fields[:title].length
    assert_equal [ "", "" ], fields.values_at(:servings, :prep_minutes)
    assert_equal Recipe.meal_times_for_course("main"), fields[:meal_times], "falls back to the course's meal times"
    assert_empty fields[:seasons]
    assert_equal "<b>Stir.</b>", fields[:steps], "stays plain text for the form, never rendered as HTML"
  end

  test "says so when the screenshot isn't a recipe" do
    assert_match "No recipe found", invalid_message([ upload ], FakeExtractor.new(FakeExtractor.recipe("is_recipe" => false)))
    assert_match "No recipe found", invalid_message([ upload ], FakeExtractor.new([ "not", "a", "hash" ]))
    empty = FakeExtractor.recipe.transform_values { |value| value.is_a?(Array) ? [] : nil }.merge("is_recipe" => true)
    assert_match "Couldn't read", invalid_message([ upload ], FakeExtractor.new(empty))
  end

  test "only real images within Claude's limits are sent" do
    extractor = FakeExtractor.new

    assert_match "Add a screenshot", invalid_message(nil, extractor)
    assert_match "Add a screenshot", invalid_message([ "https://example.com/recipe.png" ], extractor)
    assert_match "up to 4", invalid_message(Array.new(5) { upload }, extractor)
    assert_match "PNG, JPEG", invalid_message([ upload("<svg onload=alert(1)>", type: "image/png") ], extractor)
    assert_match "PNG, JPEG", invalid_message([ upload("\x00\x00\x00\x18ftypheic".b, type: "image/heic") ], extractor)
    assert_match "5 MB", invalid_message([ upload(PNG + ("x" * RecipeScreenshot::MAX_BYTES)) ], extractor)
    assert_empty extractor.screenshots
  end

  test "the media type comes from the bytes, not the browser" do
    jpeg = upload("\xFF\xD8\xFF\xE0jpeg".b, type: "image/png")

    assert_equal "image/jpeg", RecipeScreenshot.new([ jpeg ]).images.sole.media_type
  end
end
