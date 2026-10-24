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
  attr_reader :recipe

  validates :title, presence: true, length: { maximum: 300 }
  validates :description, length: { maximum: 2000 }
  validates :ingredients, :steps, presence: true, length: { maximum: Import::MAX_TEXT_LENGTH }
  validates :servings, numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: 10_000 }, allow_blank: true
  validates :prep_minutes, :cook_minutes,
            numericality: { only_integer: true, greater_than_or_equal_to: 0, less_than_or_equal_to: StructuredRecipeExtractor::MAX_MINUTES },
            allow_blank: true
  validate :usable_content

  def save
    return false unless valid?

    prep = prep_minutes.present? ? prep_minutes.to_i : nil
    cook = cook_minutes.present? ? cook_minutes.to_i : nil
    @recipe = Recipe.create!(
      title: RecipeText.plain(title), description: RecipeText.plain(description).presence,
      ingredients: RecipeText.lines(ingredients).map { |line| RecipeText.ingredient(line) },
      steps: RecipeText.lines(steps).map { |line| { "section" => nil, "text" => line } },
      servings: servings.presence&.to_i, prep_minutes: prep, cook_minutes: cook,
      total_minutes: (prep + cook if prep && cook)
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
end
