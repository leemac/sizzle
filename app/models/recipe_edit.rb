# Edits an existing recipe through the same plain fields as ManualRecipe, plus
# the details the gallery filters on. Ingredients and steps are edited as text,
# one per line, with "# Heading" lines for sections. Ingredient lines that come
# back unchanged keep their structured quantity, unit and notes.
class RecipeEdit < ManualRecipe
  FIELDS = %i[title description ingredients steps servings prep_minutes cook_minutes total_minutes
              source_url cuisine course main_ingredient tips notes].freeze
  MAX_TIP_LENGTH = 1000
  MAX_NOTES_LENGTH = 10_000

  FRACTIONS = { 1 / 8r => "⅛", 1 / 4r => "¼", 1 / 3r => "⅓", 3 / 8r => "⅜", 1 / 2r => "½",
                5 / 8r => "⅝", 2 / 3r => "⅔", 3 / 4r => "¾", 7 / 8r => "⅞" }.freeze
  INVARIANT_UNITS = [ "tsp", "tbsp", "fl oz", "ml", "l", "g", "kg", "oz", "lb", "pinch of" ].freeze

  attribute :total_minutes, :string
  attribute :cuisine, :string
  attribute :course, :string
  attribute :main_ingredient, :string
  attribute :tips, :string
  attribute :notes, :string

  validates :total_minutes,
            numericality: { only_integer: true, greater_than_or_equal_to: 0, less_than_or_equal_to: StructuredRecipeExtractor::MAX_MINUTES },
            allow_blank: true
  validates :cuisine, length: { maximum: 100 }
  validates :main_ingredient, length: { maximum: 60 }
  validates :course, inclusion: { in: Recipe::COURSES, message: "isn't one of the courses Sizzle knows" }, allow_blank: true
  validates :tips, length: { maximum: Import::MAX_TEXT_LENGTH }
  validates :notes, length: { maximum: MAX_NOTES_LENGTH }

  def self.for(recipe)
    new(recipe,
        title: recipe.title, description: recipe.description, source_url: recipe.source_url,
        servings: recipe.servings, prep_minutes: recipe.prep_minutes, cook_minutes: recipe.cook_minutes,
        total_minutes: recipe.total_minutes, cuisine: recipe.cuisine, course: recipe.course,
        main_ingredient: recipe.main_ingredient, notes: recipe.notes, tips: Array(recipe.tips).join("\n"),
        meal_times: recipe.meal_times, seasons: recipe.seasons,
        ingredients: sectioned_text(recipe.ingredients) { |ingredient| ingredient_line(ingredient) },
        steps: sectioned_text(recipe.steps) { |step| step["text"] })
  end

  # Lines grouped the way the recipe page shows them, in first-seen order. Unsectioned
  # lines after a section get a bare "#" so they don't join the section above.
  def self.sectioned_text(entries)
    groups = Array(entries).group_by { |entry| entry["section"].to_s.strip.presence }
    groups.each_with_index.flat_map do |(section, items), index|
      heading = section ? "# #{section}" : ("#" unless index.zero?)
      [ heading, *items.map { |item| yield item } ].compact
    end.join("\n")
  end

  # "1½ cups flour, sifted (or bread flour)", matching the recipe page's amount column.
  def self.ingredient_line(ingredient)
    quantity, quantity_max, unit = ingredient.values_at("quantity", "quantity_max", "unit")
    amount = quantity_text(quantity)
    amount = "#{amount}–#{quantity_text(quantity_max)}" if quantity_max && quantity_max != quantity
    largest = [ quantity.to_f, quantity_max.to_f ].max
    line = [ amount.presence, (pluralize_unit(unit, largest) if unit.present?), ingredient["item"] ].compact.join(" ")
    line += ", #{ingredient['preparation']}" if ingredient["preparation"].present?
    line += " (#{ingredient['note']})" if ingredient["note"].present?
    line
  end

  def self.quantity_text(value)
    return "" unless value.is_a?(Numeric)

    whole = value.floor
    fraction = value - whole
    return whole.to_s if fraction.zero?

    # Exact equality is intentional: the edit text must reproduce the stored float.
    glyph = FRACTIONS.find { |amount, _| whole + amount.to_f == value }&.last # rubocop:disable Lint/FloatComparison
    return whole.zero? ? glyph : "#{whole}#{glyph}" if glyph

    BigDecimal(value.to_s).to_s("F")
  end

  def self.pluralize_unit(unit, amount)
    return unit if amount <= 1 || INVARIANT_UNITS.include?(unit.downcase) || unit.end_with?("s")

    unit.match?(/(ch|sh|x)\z/) ? "#{unit}es" : "#{unit}s"
  end

  def initialize(recipe, attributes = {})
    @recipe = recipe
    super(attributes)
  end

  def save
    return false unless valid?

    prep = integer_or_nil(prep_minutes)
    cook = integer_or_nil(cook_minutes)
    url = source_url.to_s.strip.presence
    attributes = {
      title: RecipeText.plain(title), description: RecipeText.plain(description).presence,
      ingredients: parsed_ingredients, steps: parsed_steps,
      servings: integer_or_nil(servings), prep_minutes: prep, cook_minutes: cook,
      total_minutes: integer_or_nil(total_minutes) || (prep + cook if prep && cook),
      cuisine: RecipeText.plain(cuisine).presence, course: course.presence,
      main_ingredient: RecipeText.plain(main_ingredient).downcase.presence,
      tips: RecipeText.lines(tips), notes: RecipeText.plain(notes).presence, source_url: url,
      **list_attributes
    }
    # The site name came from the old page; don't show it next to a different link.
    attributes[:source_name] = nil if (url && Recipe.normalize_url(url)) != recipe.source_url
    # The imported yield ("4 servings") isn't on the form; drop it rather than contradict new servings.
    attributes[:yield_text] = nil if attributes[:servings] != recipe.servings
    recipe.assign_attributes(attributes)
    # Only real changes count as an edit; favoriting or logging a cook moves updated_at too.
    recipe.edited_at = Time.current if recipe.changed?
    recipe.save!
    true
  end

  private

  def other_recipes
    Recipe.where.not(id: recipe.id)
  end

  def integer_or_nil(value)
    value.presence&.to_i
  end

  # Each line with the section heading above it; headings themselves aren't entries.
  def sectioned_lines(text)
    RecipeText.sectioned_lines(text)
  end

  def parsed_ingredients
    unchanged = Array(recipe.ingredients).group_by { |ingredient| RecipeText.plain(self.class.ingredient_line(ingredient)) }
    sectioned_lines(ingredients).filter_map do |section, line|
      original = unchanged[line]&.shift || RecipeText.ingredient(line)
      original&.merge("section" => section)
    end
  end

  def parsed_steps
    sectioned_lines(steps).map { |section, line| { "section" => section, "text" => line } }
  end

  def usable_sections
    return if errors.any?

    super
    errors.add(:steps, "needs at least one step, not only headings") if sectioned_lines(steps).empty?
    tip_lines = RecipeText.lines(tips)
    errors.add(:tips, "must have at most #{RecipeText::MAX_ITEMS} lines") if tip_lines.length > RecipeText::MAX_ITEMS
    errors.add(:tips, "has a line longer than #{MAX_TIP_LENGTH} characters") if tip_lines.any? { |line| line.length > MAX_TIP_LENGTH }
  end
end
