# Claude's extraction, made safe to save. Claude reads hostile pages, so its
# output is untrusted even though it matches RecipeExtractor::SCHEMA: every
# field is type-checked and clamped here, enums are enforced, and images can
# only be chosen from candidates the scraper found on the page.
class RecipeDraft
  MAX_INGREDIENTS = 150
  MAX_STEPS = 100
  MAX_TAGS = 6
  MAX_TIPS = 5
  MAX_SERVINGS = 1000
  MAX_MINUTES = 7 * 24 * 60 # a week covers long ferments and cures
  MAX_QUANTITY = 100_000

  def initialize(data, images: [])
    @data = data.is_a?(Hash) ? data : {}
    @images_by_id = images.index_by(&:id)
    @image_urls = images.map(&:url)
  end

  def recipe?
    @data["is_recipe"] == true && title.present?
  end

  def title
    text(@data["title"], 300)
  end

  def attributes
    {
      title:,
      description: text(@data["description"], 2000),
      author: text(@data["author"], 200),
      servings: integer(@data["servings"], 1..MAX_SERVINGS),
      yield_text: text(@data["yield_text"], 200),
      prep_minutes: minutes(@data["prep_minutes"]),
      cook_minutes: minutes(@data["cook_minutes"]),
      total_minutes: minutes(@data["total_minutes"]),
      cuisine: text(@data["cuisine"], 60),
      course: text(@data["course"], 20).presence_in(Recipe::COURSES),
      diets: strings(@data["diets"], 30) & Recipe::DIETS,
      main_ingredient: text(@data["main_ingredient"], 60)&.downcase,
      tags: strings(@data["tags"], 40).map(&:downcase).uniq.first(MAX_TAGS),
      ingredients: ingredients,
      steps: steps,
      tips: strings(@data["tips"], 1000).first(MAX_TIPS)
    }
  end

  # The hero image Claude chose, then every other candidate as a fallback.
  def cover_urls
    [ @images_by_id[@data["hero_image_id"]]&.url, *@image_urls ].compact.uniq
  end

  def photo_urls
    Array(@data["step_image_ids"]).filter_map { |id| @images_by_id[id]&.url }.uniq - cover_urls.first(1)
  end

  private

  def ingredients
    hashes(@data["ingredients"]).filter_map do |line|
      item = text(line["item"], 200) or next
      {
        "section" => text(line["section"], 120),
        "quantity" => quantity(line["quantity"]),
        "quantity_max" => quantity(line["quantity_max"]),
        "unit" => text(line["unit"], 30),
        "item" => item,
        "preparation" => text(line["preparation"], 200),
        "note" => text(line["note"], 300)
      }
    end.first(MAX_INGREDIENTS)
  end

  def steps
    hashes(@data["steps"]).filter_map do |step|
      body = text(step["text"], 3000) or next
      { "section" => text(step["section"], 120), "text" => body }
    end.first(MAX_STEPS)
  end

  def text(value, max)
    value.strip.presence&.truncate(max) if value.is_a?(String)
  end

  def strings(values, max)
    Array(values).filter_map { |value| text(value, max) }
  end

  def hashes(values)
    Array(values).grep(Hash)
  end

  def integer(value, range)
    value if value.is_a?(Integer) && range.cover?(value)
  end

  def minutes(value)
    integer(value, 0..MAX_MINUTES)
  end

  def quantity(value)
    value if value.is_a?(Numeric) && value.finite? && value.between?(0, MAX_QUANTITY)
  end
end
