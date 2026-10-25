# Stands in for RecipeExtractor so tests never call the Claude API.
class FakeExtractor
  attr_reader :pages, :texts, :screenshots

  def initialize(result = FakeExtractor.recipe)
    @result = result
    @pages = []
    @texts = []
    @screenshots = []
  end

  def from_page(page)
    @pages << page
    @result
  end

  def from_text(text)
    @texts << text
    @result
  end

  def from_screenshots(screenshots)
    @screenshots << screenshots
    @result
  end

  def self.recipe(overrides = {})
    {
      "is_recipe" => true,
      "title" => "Weeknight Chickpea Curry",
      "description" => "A quick coconut chickpea curry.",
      "author" => "Sam Cook",
      "servings" => 4,
      "yield_text" => nil,
      "prep_minutes" => 10,
      "cook_minutes" => 20,
      "total_minutes" => 30,
      "cuisine" => "Indian",
      "course" => "main",
      "diets" => [ "vegan", "made-up-diet" ],
      "main_ingredient" => "Chickpeas",
      "tags" => [ "Weeknight", "one-pot" ],
      "ingredients" => [
        { "section" => nil, "quantity" => 1.5, "quantity_max" => nil, "unit" => "cup", "item" => "chickpeas",
          "preparation" => "drained", "note" => nil }
      ],
      "steps" => [ { "section" => nil, "text" => "Simmer everything for 20 minutes." } ],
      "tips" => [ "Keeps for 3 days." ],
      "hero_image_id" => "img1",
      "step_image_ids" => []
    }.merge(overrides)
  end
end
