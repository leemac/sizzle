# Downloads recipe image candidates, rejects anything that isn't a real
# photo, and stores them as size-capped WebP. Remote images are untrusted: we
# check magic bytes before handing them to libvips, cap the download size, and
# re-encode everything (which also strips metadata such as GPS EXIF).
class RecipeImages
  MAX_DOWNLOAD_BYTES = 15.megabytes
  MIN_EDGE = 400
  MAX_INPUT_EDGE = 16_000
  MAX_INPUT_PIXELS = 40_000_000
  MAX_EDGE = 2400
  MAX_PHOTOS = 6
  MAX_DOWNLOADS = 8
  DOWNLOAD_SECONDS = 30

  MAGIC_BYTES = {
    "jpeg" => ->(bytes) { bytes.start_with?("\xFF\xD8\xFF".b) },
    "png" => ->(bytes) { bytes.start_with?("\x89PNG\r\n\x1A\n".b) },
    "gif" => ->(bytes) { bytes.start_with?("GIF87a".b, "GIF89a".b) },
    "webp" => ->(bytes) { bytes[0, 4] == "RIFF".b && bytes[8, 4] == "WEBP".b },
    "avif/heic" => ->(bytes) { bytes[4, 4] == "ftyp".b }
  }.freeze

  def initialize(http: SafeHttp.new)
    @http = http
  end

  # Cover fallbacks and step photos share one deadline and attempt budget.
  # At most MAX_DOWNLOADS * MAX_DOWNLOAD_BYTES can be downloaded per import.
  # Attaches the first usable URL in `cover_urls` as the cover and up to
  # MAX_PHOTOS of `photo_urls` as step photos. Failures are skipped quietly —
  # a recipe without a photo is still a recipe.
  def attach(recipe, cover_urls:, photo_urls: [])
    deadline = monotonic_time + DOWNLOAD_SECONDS
    attempts = 0
    cover_urls.uniq.each do |url|
      break if attempts >= MAX_DOWNLOADS || monotonic_time >= deadline

      attempts += 1
      webp = fetch_webp(url, deadline:) or next
      recipe.cover.attach(io: StringIO.new(webp), filename: "cover.webp", content_type: "image/webp")
      break
    end

    photo_urls.uniq.first(MAX_PHOTOS).each_with_index do |url, index|
      break if attempts >= MAX_DOWNLOADS || monotonic_time >= deadline

      attempts += 1
      webp = fetch_webp(url, deadline:) or next
      recipe.photos.attach(io: StringIO.new(webp), filename: "step-#{index + 1}.webp", content_type: "image/webp")
    end
  end

  # Returns WebP bytes for the image at `url`, or nil if it isn't usable.
  def fetch_webp(url, deadline: nil)
    response = @http.get(url, max_bytes: MAX_DOWNLOAD_BYTES, accept: "image/", deadline:)
    to_webp(response.body)
  rescue SafeHttp::Error => e
    Rails.logger.info("[RecipeImages] skipped #{url}: #{e.message}")
    nil
  end

  def to_webp(bytes)
    return unless MAGIC_BYTES.values.any? { |check| check.call(bytes.b) }

    image = Vips::Image.new_from_buffer(bytes, "")
    width, height = image.width, image.height
    return if [ width, height ].min < MIN_EDGE
    return if [ width, height ].max > MAX_INPUT_EDGE || width * height > MAX_INPUT_PIXELS

    Vips::Image.thumbnail_buffer(bytes, MAX_EDGE, height: MAX_EDGE, size: :down)
      .webpsave_buffer(Q: 82, strip: true)
  rescue Vips::Error => e
    Rails.logger.info("[RecipeImages] could not decode image: #{e.message.lines.first}")
    nil
  end

  private

  def monotonic_time
    Process.clock_gettime(Process::CLOCK_MONOTONIC)
  end
end
