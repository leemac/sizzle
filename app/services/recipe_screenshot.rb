# Reads a recipe from screenshots or a PDF to fill in the Write a recipe form.
# Nothing is saved: Claude's answer goes through RecipeDraft and comes back as
# the form's plain fields for the user to check before saving. Uploads are
# untrusted. Only image types Claude accepts, or a PDF, identified by magic
# bytes rather than the browser's content type, within the size limits are sent
# on. They're never decoded, parsed, resized or stored here.
class RecipeScreenshot
  class Invalid < StandardError; end

  MAX_FILES = 4
  MAX_BYTES = 5.megabytes # Claude's limit per image
  MAX_PDF_BYTES = 10.megabytes # well inside Claude's 32 MB request limit once base64-encoded
  MEDIA_TYPES = { "png" => "image/png", "jpeg" => "image/jpeg", "gif" => "image/gif", "webp" => "image/webp" }.freeze
  PDF_TYPE = "application/pdf".freeze
  PDF_MAGIC = "%PDF-".b.freeze

  Image = Data.define(:media_type, :bytes)

  # Either up to MAX_FILES images, or one PDF's bytes.
  attr_reader :images, :pdf

  def initialize(uploads, extractor: nil)
    files = read(uploads)
    @pdf = files.find { |file| file.media_type == PDF_TYPE }&.bytes
    @images = @pdf ? [] : files
    @extractor = extractor
  end

  # The ManualRecipe fields Claude could read, as the form holds them. Fields it
  # couldn't read are blank so the form keeps whatever the user already typed.
  def fields
    data = pdf ? extractor.from_pdf(pdf) : extractor.from_screenshots(images)
    unless data.is_a?(Hash) && data["is_recipe"] == true
      raise Invalid, pdf ? "No recipe found in that PDF." : "No recipe found in that screenshot. Try one that shows the ingredients or method."
    end

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
    if fields.values.all?(&:blank?)
      raise Invalid, pdf ? "Couldn't read a recipe from that PDF." : "Couldn't read a recipe from that screenshot. Try a sharper or closer screenshot."
    end

    fields
  rescue RecipeExtractor::Rejected
    raise unless pdf

    raise Invalid, "Claude couldn't open that PDF. It may be password-protected, damaged or too long. Try a PDF of just the recipe."
  end

  private

  def extractor
    @extractor ||= RecipeExtractor.new
  end

  def read(uploads)
    uploads = Array(uploads)
    raise Invalid, "Add a screenshot or PDF of the recipe." if uploads.empty?
    raise Invalid, "Add up to #{MAX_FILES} screenshots at a time." if uploads.size > MAX_FILES

    files = uploads.map { |upload| read_file(upload) }
    if files.any? { |file| file.media_type == PDF_TYPE } && files.size > 1
      raise Invalid, "Add one PDF at a time, without screenshots."
    end

    files
  end

  def read_file(upload)
    raise Invalid, "Add a screenshot or PDF of the recipe." unless upload.is_a?(ActionDispatch::Http::UploadedFile)

    bytes = upload.read(MAX_PDF_BYTES + 1).to_s.b
    if bytes.start_with?(PDF_MAGIC)
      raise Invalid, "The PDF must be #{MAX_PDF_BYTES / 1.megabyte} MB or smaller." if bytes.bytesize > MAX_PDF_BYTES

      return Image.new(media_type: PDF_TYPE, bytes:)
    end

    format = MEDIA_TYPES.keys.find { |name| RecipeImages::MAGIC_BYTES.fetch(name).call(bytes) }
    raise Invalid, "Add PNG, JPEG, WebP or GIF screenshots, or a PDF." unless format
    raise Invalid, "Each screenshot must be #{MAX_BYTES / 1.megabyte} MB or smaller." if bytes.bytesize > MAX_BYTES

    Image.new(media_type: MEDIA_TYPES.fetch(format), bytes:)
  end
end
