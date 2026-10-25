# One recipe from an uploaded cookbook export, made safe to save. The file may
# have been edited or made by someone else, so it's as untrusted as a fetched
# page: content goes through RecipeDraft's clamps, and the personal fields an
# export adds (notes, rating, dates, cooking history) are checked here.
class CookbookRecipe
  UID = /\A\h{8}-\h{4}-\h{4}-\h{4}-\h{12}\z/
  MAX_COOKS = 1_000
  MAX_PHOTOS = RecipeImages::MAX_PHOTOS
  EARLIEST = Time.utc(2000)

  def initialize(data)
    @data = data
    @draft = RecipeDraft.new(data.merge("is_recipe" => true), video: data["video_metadata"])
  end

  def valid?
    @draft.recipe?
  end

  def uid
    @data["uid"] if @data["uid"].is_a?(String) && @data["uid"].match?(UID)
  end

  def source_url
    url = @data["source_url"]
    return unless url.is_a?(String) && url.length <= 2048

    uri = URI.parse(url.strip)
    uri.to_s if uri.is_a?(URI::HTTP) && uri.host.present? && uri.userinfo.nil?
  rescue URI::InvalidURIError
    nil
  end

  def attributes
    @draft.attributes.merge(
      uid:,
      source_url:,
      source_name: text(@data["source_name"], 200),
      # What the cook chose, even none: no guessing from the course like a fresh import.
      meal_times: Recipe::MEAL_TIMES & strings(@data["meal_times"], 20),
      # Editing allows more tips than extraction keeps.
      tips: strings(@data["tips"], RecipeEdit::MAX_TIP_LENGTH).first(RecipeText::MAX_ITEMS),
      notes: RecipeText.plain(@data["notes"].to_s).strip.presence&.truncate(RecipeEdit::MAX_NOTES_LENGTH),
      rating: (@data["rating"] if @data["rating"].is_a?(Integer) && @data["rating"].between?(1, 5)),
      favorited_at: time(@data["favorited_at"]),
      archived_at: time(@data["archived_at"]),
      edited_at: time(@data["edited_at"]),
      created_at: time(@data["created_at"]) || Time.current
    ).compact
  end

  def cooked_at
    Array(@data["cooks"]).filter_map { |cook| time(cook["cooked_at"]) if cook.is_a?(Hash) }.uniq.sort.first(MAX_COOKS)
  end

  def cover_path
    path(@data["cover"])
  end

  def photo_paths
    Array(@data["photos"]).filter_map { |value| path(value) }.uniq.first(MAX_PHOTOS)
  end

  private

  def path(value)
    value if value.is_a?(String) && value.match?(CookbookArchive::IMAGE_PATH)
  end

  # Times from the past that make sense for a cookbook; anything else is dropped.
  def time(value)
    return unless value.is_a?(String) && value.length <= 40

    parsed = Time.iso8601(value)
    parsed if parsed.between?(EARLIEST, 1.day.from_now)
  rescue ArgumentError
    nil
  end

  def text(value, max)
    RecipeText.visible(value).strip.presence&.truncate(max) if value.is_a?(String)
  end

  def strings(values, max)
    Array(values).filter_map { |value| text(value, max) }
  end
end
