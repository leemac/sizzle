# An extracted recipe, made safe to save. Both sources are untrusted: Claude
# reads hostile pages, and schema.org data is written by the page itself. Every
# field is type-checked and clamped here, enums are enforced, and images can
# only be chosen from candidates the scraper found on the page. Limits match
# StructuredRecipeExtractor's (RecipeText), so valid page data passes unchanged.
class RecipeDraft
  MAX_INGREDIENTS = RecipeText::MAX_ITEMS
  MAX_STEPS = RecipeText::MAX_ITEMS
  MAX_TAGS = 6
  MAX_TIPS = 5
  MAX_SERVINGS = 10_000
  MAX_MINUTES = StructuredRecipeExtractor::MAX_MINUTES
  MAX_QUANTITY = 100_000
  MAX_VIDEO_SECONDS = 7.days.to_i
  MAX_VIDEO_CHAPTERS = 50

  def initialize(data, images: [], video: nil)
    @data = data.is_a?(Hash) ? data : {}
    @images_by_id = images.index_by(&:id)
    @image_urls = images.map(&:url)
    @video = video.is_a?(Hash) ? video : {}
  end

  # Page metadata is hostile too. Store bounded plain text, never imported HTML.
  def self.source_metadata(page)
    { "title" => [ page.title, 300 ], "site_name" => [ page.site_name, 200 ],
      "description" => [ page.description, 500 ] }.filter_map do |key, (value, limit)|
      next unless value.is_a?(String)

      fragment = Nokogiri::HTML5.fragment(value)
      fragment.css("script, style").remove
      text = fragment.text.squish.truncate(limit)
      [ key, text ] if text.present?
    end.to_h
  end

  def recipe?
    @data["is_recipe"] == true && title.present?
  end

  def title
    text(@data["title"], 300)
  end

  def attributes
    course = text(@data["course"], 20).presence_in(Recipe::COURSES)
    {
      title:,
      description: text(@data["description"], 2000),
      author: text(@data["author"], 300),
      servings: integer(@data["servings"], 1..MAX_SERVINGS),
      yield_text: text(@data["yield_text"], 300),
      prep_minutes: minutes(@data["prep_minutes"]),
      cook_minutes: minutes(@data["cook_minutes"]),
      total_minutes: minutes(@data["total_minutes"]),
      cuisine: text(@data["cuisine"], 100),
      course:,
      diets: strings(@data["diets"], 30) & Recipe::DIETS,
      meal_times: meal_times(course),
      seasons: Recipe.seasons_from(strings(@data["seasons"], 20)),
      main_ingredient: text(@data["main_ingredient"], 60)&.downcase,
      tags: strings(@data["tags"], 40).map(&:downcase).uniq.first(MAX_TAGS),
      ingredients: ingredients,
      steps: steps,
      tips: strings(@data["tips"], 1000).first(MAX_TIPS),
      video_metadata:
    }
  end

  def video_metadata
    id = @video["id"]
    return {} unless id.is_a?(String) && id.match?(YoutubeVideo::ID_PATTERN)

    duration = integer(@video["duration_seconds"], 1..MAX_VIDEO_SECONDS)
    last_start = -1
    chapters = hashes(@video["chapters"]).filter_map do |chapter|
      start = integer(chapter["start_seconds"], 0..MAX_VIDEO_SECONDS)
      title = text(RecipeText.plain(chapter["title"]).squish, 200)
      next unless start && title && start > last_start && (!duration || start < duration)

      last_start = start
      { "start_seconds" => start, "title" => title }
    end.first(MAX_VIDEO_CHAPTERS)

    { "id" => id, "duration_seconds" => duration, "chapters" => chapters,
      "written_recipe_url" => web_url(@video["written_recipe_url"]) }
  end

  # The hero image Claude chose, then every other candidate as a fallback.
  def cover_urls
    [ @images_by_id[@data["hero_image_id"]]&.url, *@image_urls ].compact.uniq
  end

  def photo_urls
    Array(@data["step_image_ids"]).filter_map { |id| @images_by_id[id]&.url }.uniq - cover_urls.first(1)
  end

  private

  # The source's meal times, or a guess from the course when it gives none.
  def meal_times(course)
    given = Recipe::MEAL_TIMES & strings(@data["meal_times"], 20)
    given.presence || Recipe.meal_times_for_course(course)
  end

  def web_url(value)
    return unless value.is_a?(String) && value.length <= 2048

    uri = URI.parse(value.strip)
    uri.to_s if uri.is_a?(URI::HTTP) && uri.host.present? && uri.userinfo.nil?
  rescue URI::InvalidURIError
    nil
  end

  def ingredients
    hashes(@data["ingredients"]).filter_map do |line|
      item = text(line["item"], RecipeText::MAX_INGREDIENT_LENGTH) or next
      {
        "section" => text(line["section"], 300),
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
      body = text(step["text"], RecipeText::MAX_STEP_LENGTH) or next
      { "section" => text(step["section"], 300), "text" => body }
    end.first(MAX_STEPS)
  end

  def text(value, max)
    RecipeText.visible(value).strip.presence&.truncate(max) if value.is_a?(String)
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
