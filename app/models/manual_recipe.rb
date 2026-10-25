# The web form accepts plain recipe fields, never arbitrary Recipe attributes.
class ManualRecipe
  include ActiveModel::Model
  include ActiveModel::Attributes

  attribute :title, :string
  attribute :description, :string
  attribute :ingredients, :string
  attribute :steps, :string
  attribute :servings, :string
  attribute :prep_minutes, :string
  attribute :cook_minutes, :string
  attribute :source_url, :string
  attr_reader :recipe, :duplicate_recipe

  validates :title, presence: true, length: { maximum: 300 }
  validates :description, length: { maximum: 2000 }
  validates :ingredients, :steps, presence: true, length: { maximum: Import::MAX_TEXT_LENGTH }
  validates :servings, numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: 10_000 }, allow_blank: true
  validates :prep_minutes, :cook_minutes,
            numericality: { only_integer: true, greater_than_or_equal_to: 0, less_than_or_equal_to: StructuredRecipeExtractor::MAX_MINUTES },
            allow_blank: true
  validates :source_url, length: { maximum: 2048 }
  validate :usable_content
  validate :usable_sections
  validate :source_url_is_new_web_link, if: -> { source_url.present? }

  def save
    return false unless valid?

    prep = prep_minutes.present? ? prep_minutes.to_i : nil
    cook = cook_minutes.present? ? cook_minutes.to_i : nil
    @recipe = Recipe.create!(
      title: RecipeText.plain(title), description: RecipeText.plain(description).presence,
      ingredients: RecipeText.sectioned_lines(ingredients).map { |section, line| RecipeText.ingredient(line).merge("section" => section) },
      steps: RecipeText.lines(steps).map { |line| { "section" => nil, "text" => line } },
      servings: servings.presence&.to_i, prep_minutes: prep, cook_minutes: cook,
      total_minutes: (prep + cook if prep && cook), source_url: source_url.to_s.strip.presence
    )
    true
  end

  private

  def usable_content
    return if errors.any?

    errors.add(:title, "can't be blank") if RecipeText.plain(title).blank?
    { ingredients: RecipeText::MAX_INGREDIENT_LENGTH, steps: RecipeText::MAX_STEP_LENGTH }.each do |field, maximum|
      lines = RecipeText.lines(public_send(field))
      errors.add(field, "can't be blank") if lines.empty?
      errors.add(field, "must have at most #{RecipeText::MAX_ITEMS} lines") if lines.length > RecipeText::MAX_ITEMS
      errors.add(field, "has a line longer than #{maximum} characters") if lines.any? { |line| line.length > maximum }
    end
  end

  def usable_sections
    return if errors.any?

    errors.add(:ingredients, "needs at least one ingredient, not only headings") if RecipeText.sectioned_lines(ingredients).empty?
  end

  # The source is only shown as a link, never fetched, but it must be a web link
  # (no javascript: or data:) and can't duplicate a recipe already saved from it.
  def source_url_is_new_web_link
    return if errors.include?(:source_url)

    uri = URI.parse(source_url.strip)
    return errors.add(:source_url, "must be a link starting with http:// or https://") unless uri.is_a?(URI::HTTP) && uri.host.present?

    @duplicate_recipe = other_recipes.find_by(source_url: Recipe.normalize_url(source_url))
    errors.add(:source_url, "is already in your cookbook") if duplicate_recipe
  rescue URI::InvalidURIError
    errors.add(:source_url, "isn't a valid link")
  end

  def other_recipes
    Recipe.all
  end
end
