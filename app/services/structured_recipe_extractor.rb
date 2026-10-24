# Reads common schema.org Recipe fields locally. Unsupported or incomplete
# recipes return nil so the caller can offer manual entry or optional AI.
class StructuredRecipeExtractor
  class InvalidRecipe < StandardError; end

  MAX_DEPTH = 10
  MAX_MINUTES = 525_600
  DIETS = {
    "VegetarianDiet" => "vegetarian", "VeganDiet" => "vegan", "GlutenFreeDiet" => "gluten-free",
    "LowCarbDiet" => "low-carb"
  }.freeze

  def from_page(page)
    data = page.structured_recipe
    return unless data.is_a?(Hash)

    title = required_text(data["name"], maximum: 300)
    ingredients = ingredient_lines(data["recipeIngredient"])
    steps = instruction_steps(data["recipeInstructions"])
    raise InvalidRecipe if ingredients.empty? || steps.empty?
    raise InvalidRecipe if ingredients.length > RecipeText::MAX_ITEMS || steps.length > RecipeText::MAX_ITEMS

    prep = minutes(data["prepTime"])
    cook = minutes(data["cookTime"])
    yield_value = first_value(data["recipeYield"])
    yield_value = yield_value.to_s if yield_value.is_a?(Integer)
    yield_text = optional_text(yield_value, maximum: 300)
    servings = yield_text&.match(/\A(\d{1,5})(?:\s+(?:servings?|people|persons?))?\z/i)&.captures&.first&.to_i

    {
      "is_recipe" => true, "title" => title,
      "description" => optional_text(data["description"], maximum: 2000),
      "author" => author(data["author"]),
      "servings" => servings&.between?(1, 10_000) ? servings : nil, "yield_text" => yield_text,
      "prep_minutes" => prep, "cook_minutes" => cook,
      "total_minutes" => minutes(data["totalTime"]) || (prep + cook if prep && cook),
      "cuisine" => optional_text(first_value(data["recipeCuisine"]), maximum: 100),
      "course" => course(first_value(data["recipeCategory"])),
      "diets" => Array(data["suitableForDiet"]).filter_map { |diet|
        DIETS[diet.delete_prefix("https://schema.org/").delete_prefix("http://schema.org/")] if diet.is_a?(String)
      }.uniq,
      "tags" => [], "main_ingredient" => nil, "tips" => [],
      "ingredients" => ingredients.map { |line| RecipeText.ingredient(line) }, "steps" => steps,
      "hero_image_id" => page.images.first&.id, "step_image_ids" => []
    }
  rescue InvalidRecipe
    nil
  end

  private

  def required_text(value, maximum:)
    raise InvalidRecipe unless value.is_a?(String) && value.length <= Import::MAX_TEXT_LENGTH

    text = RecipeText.plain(value)
    raise InvalidRecipe if text.blank? || text.length > maximum

    text
  end

  def optional_text(value, maximum:)
    return unless value.is_a?(String)

    RecipeText.plain(value.first(Import::MAX_TEXT_LENGTH)).truncate(maximum).presence
  end

  def ingredient_lines(value)
    values = value.is_a?(Array) ? value : [ value ]
    raise InvalidRecipe if values.length > RecipeText::MAX_ITEMS

    values.flat_map do |entry|
      text = required_text(entry, maximum: Import::MAX_TEXT_LENGTH)
      text.lines.map(&:strip).reject(&:empty?).map do |line|
        raise InvalidRecipe if line.length > RecipeText::MAX_INGREDIENT_LENGTH

        line
      end
    end
  end

  def instruction_steps(value, section: nil, depth: 0)
    raise InvalidRecipe if depth > MAX_DEPTH

    steps = case value
    when String
      text = required_text(value, maximum: Import::MAX_TEXT_LENGTH)
      text.lines.map(&:strip).reject(&:empty?).map do |line|
        raise InvalidRecipe if line.length > RecipeText::MAX_STEP_LENGTH

        { "section" => section, "text" => line }
      end
    when Array
      raise InvalidRecipe if value.length > RecipeText::MAX_ITEMS

      value.flat_map { |child| instruction_steps(child, section:, depth: depth + 1) }
    when Hash
      if value.key?("itemListElement")
        instruction_steps(value["itemListElement"], section: optional_text(value["name"], maximum: 300) || section, depth: depth + 1)
      else
        instruction_steps(value["text"], section:, depth: depth + 1)
      end
    else
      raise InvalidRecipe
    end
    raise InvalidRecipe if steps.length > RecipeText::MAX_ITEMS

    steps
  end

  def minutes(value)
    return unless value.is_a?(String)

    match = value.match(/\AP(?:(\d{1,4})D)?(?:T(?:(\d{1,4}(?:\.\d{1,3})?)H)?(?:(\d{1,6}(?:\.\d{1,3})?)M)?(?:(\d{1,6}(?:\.\d{1,3})?)S)?)?\z/i)
    return unless match && match.captures.any?

    days, hours, mins, seconds = match.captures.map(&:to_f)
    result = (days * 1440 + hours * 60 + mins + seconds / 60).ceil
    result if result.between?(0, MAX_MINUTES)
  end

  def first_value(value)
    value.is_a?(Array) ? value.first : value
  end

  def author(value)
    value = first_value(value)
    optional_text(value.is_a?(Hash) ? value["name"] : value, maximum: 300)
  end

  def course(value)
    text = optional_text(value, maximum: 100)&.downcase
    return text if Recipe::COURSES.include?(text)

    { "main course" => "main", "dinner" => "main", "lunch" => "main", "beverage" => "drink" }[text]
  end
end
