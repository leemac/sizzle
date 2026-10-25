# Reads a recipe from screenshots to fill in the Write a recipe form. Nothing is
# saved: Claude's answer goes through RecipeDraft and comes back as the form's
# plain fields for the user to check before saving. Uploads are untrusted. Only
# image types Claude accepts, identified by magic bytes rather than the browser's
# content type, within Claude's size limit are sent on. They're never decoded,
# resized or stored here.
class RecipeScreenshot
  class Invalid < StandardError; end

  MAX_FILES = 4
  MAX_BYTES = 5.megabytes # Claude's limit per image
  MEDIA_TYPES = { "png" => "image/png", "jpeg" => "image/jpeg", "gif" => "image/gif", "webp" => "image/webp" }.freeze

  Image = Data.define(:media_type, :bytes)

  attr_reader :images

  def initialize(uploads, extractor: nil)
    @images = read(uploads)
    @extractor = extractor
  end

  # The ManualRecipe fields Claude could read, as the form holds them. Fields it
  # couldn't read are blank so the form keeps whatever the user already typed.
  def fields
    data = extractor.from_screenshots(images)
    raise Invalid, "No recipe found in that screenshot. Try one that shows the ingredients or method." unless data.is_a?(Hash) && data["is_recipe"] == true

    draft = RecipeDraft.new(data).attributes
    fields = {
      title: draft[:title].to_s,
      description: draft[:description].to_s,
      ingredients: RecipeEdit.sectioned_text(draft[:ingredients]) { |ingredient| RecipeEdit.ingredient_line(ingredient) },
      steps: RecipeEdit.sectioned_text(draft[:steps]) { |step| step["text"] },
      servings: draft[:servings].to_s,
      prep_minutes: draft[:prep_minutes].to_s,
      cook_minutes: draft[:cook_minutes].to_s,
      meal_times: draft[:meal_times],
      seasons: draft[:seasons]
    }
    raise Invalid, "Couldn't read a recipe from that screenshot. Try a sharper or closer screenshot." if fields.values.all?(&:blank?)

    fields
  end

  private

  def extractor
    @extractor ||= RecipeExtractor.new
  end

  def read(uploads)
    uploads = Array(uploads)
    raise Invalid, "Add a screenshot of the recipe." if uploads.empty?
    raise Invalid, "Add up to #{MAX_FILES} screenshots at a time." if uploads.size > MAX_FILES

    uploads.map do |upload|
      raise Invalid, "Add a screenshot of the recipe." unless upload.is_a?(ActionDispatch::Http::UploadedFile)
      raise Invalid, "Each screenshot must be #{MAX_BYTES / 1.megabyte} MB or smaller." if upload.size > MAX_BYTES

      bytes = upload.read(MAX_BYTES + 1).to_s.b
      raise Invalid, "Each screenshot must be #{MAX_BYTES / 1.megabyte} MB or smaller." if bytes.bytesize > MAX_BYTES

      format = MEDIA_TYPES.keys.find { |name| RecipeImages::MAGIC_BYTES.fetch(name).call(bytes) }
      raise Invalid, "Screenshots must be PNG, JPEG, WebP or GIF images." unless format

      Image.new(media_type: MEDIA_TYPES.fetch(format), bytes:)
    end
  end
end
