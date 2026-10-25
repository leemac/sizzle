require "rubygems/package"
require "digest"
require "zlib"
require "tempfile"
require "timeout"

# Portable, bounded cookbook data. The web controller always runs this builder
# through CookbookExportRunner, which enforces the process deadline.
class CookbookExport
  class Error < StandardError; end
  class TooLarge < Error; end
  class Busy < Error; end
  class Expired < Error; end

  MAX_RECIPES = 5_000
  MAX_PHOTOS = 10_000
  MAX_COOKS = 50_000
  MAX_BYTES = 64.megabytes
  MAX_METADATA_BYTES = 8.megabytes
  MAX_RECORD_BYTES = 1.megabyte
  MAX_IMAGE_BYTES = 16.megabytes
  DOWNLOAD_SECONDS = 30
  LIMIT_MESSAGE = "This cookbook exceeds the export's size or item limits. Use a server backup for larger collections."
  FIELDS = %w[id uid title description author source_url source_name source_host servings yield_text
              prep_minutes cook_minutes total_minutes cuisine course main_ingredient diets tags
              ingredients steps tips notes rating created_at updated_at edited_at archived_at
              favorited_at video_metadata meal_times seasons].freeze

  # Only file reads and the HTTP body write run inside this timeout. No database
  # work or application mutations can be interrupted. A short Content-Length
  # makes a timed-out transfer fail instead of appearing to be a complete archive.
  class Download
    def initialize(file, lock: nil, seconds: DOWNLOAD_SECONDS)
      @file = file
      @lock = lock
      @seconds = seconds
    end

    def size = @file.size

    def each
      Timeout.timeout(@seconds, Expired, "Cookbook download deadline exceeded") do
        @file.rewind
        while (chunk = @file.read(64.kilobytes))
          yield chunk
        end
      end
    ensure
      close
    end

    def close
      @file.close!
    ensure
      @lock&.close unless @lock&.closed?
    end
  end

  # Convenience for offline callers and transactional tests. Web requests use
  # the isolated runner rather than building on a Puma thread.
  def build
    file = Tempfile.new([ "sizzle-cookbook-", ".tar.gz" ], binmode: true)
    write_to(file)
    Download.new(file)
  rescue StandardError
    file&.close!
    raise
  end

  def write_to(file)
    preflight!
    @content_bytes = 0
    @photo_count = 0
    @cook_count = 0
    gzip = Zlib::GzipWriter.new(file)
    Gem::Package::TarWriter.new(gzip) do |tar|
      write_cookbook(tar)
      add_text(tar, "README.txt", "Sizzle cookbook export, format version 1.\n" \
        "cookbook.json contains saved and archived recipes, notes, favorites, ratings and cooking history.\n" \
        "Image paths are relative to this archive. Extract with any tar.gz archive tool.\n" \
        "This is a portable export, not a server backup. Another Sizzle server can import it from\n" \
        "Settings when SIZZLE_COOKBOOK_IMPORT is on; recipes it already has are skipped.\n" \
        "For backup and restore, follow docs/self-hosting.md in the Sizzle repository.\n")
    end
    gzip.finish
    file.flush
    raise TooLarge, LIMIT_MESSAGE if file.size > MAX_BYTES
  end

  private

  def preflight!
    raise TooLarge, LIMIT_MESSAGE if Recipe.limit(MAX_RECIPES + 1).count > MAX_RECIPES
    raise TooLarge, LIMIT_MESSAGE if Cook.limit(MAX_COOKS + 1).count > MAX_COOKS

    attachments = ActiveStorage::Attachment.where(record_type: "Recipe")
    raise TooLarge, LIMIT_MESSAGE if attachments.limit(MAX_PHOTOS + 1).count > MAX_PHOTOS
    blobs = ActiveStorage::Blob.where(id: attachments.select(:blob_id))
    raise TooLarge, LIMIT_MESSAGE if blobs.sum(:byte_size) > MAX_BYTES || blobs.where("byte_size > ?", MAX_IMAGE_BYTES).exists?

    # Check raw data sizes in SQLite before materializing imported text/JSON as
    # Ruby objects. The serialization and manifest are independently capped too.
    lengths = FIELDS.map do |field|
      cast = Arel::Nodes::NamedFunction.new("CAST", [ Arel::Nodes::As.new(Recipe.arel_table[field], Arel.sql("BLOB")) ])
      length = Arel::Nodes::NamedFunction.new("length", [ cast ])
      Arel::Nodes::NamedFunction.new("COALESCE", [ length, Arel::Nodes.build_quoted(0) ])
    end.reduce(:+)
    raise TooLarge, LIMIT_MESSAGE if Recipe.where(lengths.gt(MAX_RECORD_BYTES)).exists?
    raise TooLarge, LIMIT_MESSAGE if Recipe.sum(lengths) > MAX_METADATA_BYTES
  end

  def write_cookbook(tar)
    Tempfile.create([ "sizzle-recipes-", ".json" ]) do |manifest|
      # Ruby 3.3 doesn't support Tempfile.create(anonymous: true). Unlink the
      # open file immediately so the OS reclaims it even if this child is killed.
      File.unlink(manifest.path)
      write_metadata(manifest, "{\"format_version\":1,\"exported_at\":#{Time.current.iso8601.to_json},\"recipes\":[")
      count = 0
      Recipe.with_attached_cover.with_attached_photos.find_each(batch_size: 50) do |recipe|
        count += 1
        raise TooLarge, LIMIT_MESSAGE if count > MAX_RECIPES
        write_metadata(manifest, ",") if count > 1
        dates = recipe.cooks.order(:cooked_at, :id).limit(MAX_COOKS + 1).pluck(:cooked_at)
        @cook_count += dates.size
        raise TooLarge, LIMIT_MESSAGE if @cook_count > MAX_COOKS
        data = recipe.attributes.slice(*FIELDS).merge(
          "cooks" => dates.map { |date| { cooked_at: date.iso8601 } },
          "cover" => recipe.cover.attached? ? add_image(tar, recipe.cover, "recipes/#{recipe.id}/cover") : nil,
          "photos" => recipe.photos.sort_by(&:id).map.with_index { |photo, index| add_image(tar, photo, "recipes/#{recipe.id}/photo-#{index + 1}") }
        ).to_json
        raise TooLarge, LIMIT_MESSAGE if data.bytesize > MAX_RECORD_BYTES
        write_metadata(manifest, data)
      end
      write_metadata(manifest, "]}")
      manifest.flush
      manifest.rewind
      charge_bytes!(manifest.size)
      tar.add_file_simple("cookbook.json", 0o600, manifest.size) { |entry| IO.copy_stream(manifest, entry) }
    end
  end

  def write_metadata(file, text)
    raise TooLarge, LIMIT_MESSAGE if file.pos + text.bytesize > MAX_METADATA_BYTES
    file.write(text)
  end

  def add_image(tar, attachment, path)
    @photo_count += 1
    blob = attachment.blob
    raise TooLarge, LIMIT_MESSAGE if @photo_count > MAX_PHOTOS || blob.byte_size > MAX_IMAGE_BYTES
    raise Error, "Cookbook export requires local photo storage." unless blob.service.is_a?(ActiveStorage::Service::DiskService)
    charge_bytes!(blob.byte_size)
    # Never use imported titles, attachment filenames or blob keys as archive paths.
    extension = { "image/webp" => "webp", "image/jpeg" => "jpg", "image/png" => "png" }.fetch(blob.content_type, "bin")
    path = "#{path}.#{extension}"
    tar.add_file_simple(path, 0o600, blob.byte_size) do |entry|
      actual = 0
      digest = Digest::MD5.new
      blob.service.download(blob.key) do |chunk|
        actual += chunk.bytesize
        raise Error, "A saved photo changed during export. Try again." if actual > blob.byte_size
        digest << chunk
        entry.write(chunk)
      end
      raise Error, "A saved photo changed during export. Try again." unless actual == blob.byte_size
      if blob.checksum.present? && digest.base64digest != blob.checksum
        raise Error, "A saved photo failed its integrity check. Check your photo storage before exporting."
      end
    end
    path
  end

  def charge_bytes!(size)
    @content_bytes += size
    raise TooLarge, LIMIT_MESSAGE if @content_bytes > MAX_BYTES
  end

  def add_text(tar, name, text)
    charge_bytes!(text.bytesize)
    tar.add_file_simple(name, 0o600, text.bytesize) { |entry| entry.write(text) }
  end
end
