require "rubygems/package"
require "zlib"

# Reads an uploaded Sizzle cookbook export (see CookbookExport). The upload is
# untrusted: it is never extracted to disk, entry names are only compared with
# an allowlist, and the entry count and expanded size are capped so a small
# file can't expand without limit. Only regular files are read.
class CookbookArchive
  class Invalid < StandardError; end

  FORMAT_VERSION = 1
  MAX_UPLOAD_BYTES = CookbookExport::MAX_BYTES
  MAX_ENTRIES = CookbookExport::MAX_PHOTOS + 10
  MAX_EXPANDED_BYTES = CookbookExport::MAX_BYTES + CookbookExport::MAX_METADATA_BYTES
  MAX_IMAGE_BYTES = CookbookExport::MAX_IMAGE_BYTES
  MANIFEST = "cookbook.json"
  IMAGE_PATH = %r{\Arecipes/\d{1,12}/(?:cover|photo-\d{1,5})\.(?:webp|jpg|png)\z}
  NOT_AN_EXPORT = "That file isn't a Sizzle cookbook export. Download one from Settings → Your data on the other server."
  TOO_LARGE = "That cookbook is larger than Sizzle can import. Export a smaller cookbook and try again."

  def self.gzip?(io)
    magic = io.read(2)
    io.rewind
    magic == "\x1F\x8B".b
  end

  def initialize(path)
    @path = path
  end

  # The list of recipe entries, each an untrusted Hash for CookbookRecipe.
  def recipes
    manifest = nil
    each_entry do |name, entry|
      next unless name == MANIFEST
      raise Invalid, NOT_AN_EXPORT if manifest || entry.header.size > CookbookExport::MAX_METADATA_BYTES

      manifest = entry.read.to_s
    end
    raise Invalid, NOT_AN_EXPORT unless manifest

    data = JSON.parse(manifest, max_nesting: 20)
    raise Invalid, NOT_AN_EXPORT unless data.is_a?(Hash) && data["recipes"].is_a?(Array)
    unless data["format_version"] == FORMAT_VERSION
      raise Invalid, "This cookbook was exported by a newer version of Sizzle. Update this server and try again."
    end
    raise Invalid, TOO_LARGE if data["recipes"].size > CookbookExport::MAX_RECIPES

    data["recipes"].grep(Hash)
  rescue JSON::ParserError, EncodingError
    raise Invalid, NOT_AN_EXPORT
  end

  # Yields the path and bytes of each photo in `paths`, skipping oversized ones.
  def each_image(paths)
    each_entry do |name, entry|
      next unless paths.include?(name) && entry.header.size <= MAX_IMAGE_BYTES

      yield name, entry.read.to_s
    end
  end

  private

  def each_entry
    count = 0
    expanded = 0
    File.open(@path, "rb") do |file|
      raise Invalid, TOO_LARGE if file.size > MAX_UPLOAD_BYTES

      Zlib::GzipReader.wrap(file) do |gzip|
        Gem::Package::TarReader.new(gzip) do |tar|
          tar.each do |entry|
            count += 1
            expanded += entry.header.size
            raise Invalid, TOO_LARGE if count > MAX_ENTRIES || expanded > MAX_EXPANDED_BYTES
            next unless entry.file?

            name = entry.full_name
            yield name, entry if name == MANIFEST || name.match?(IMAGE_PATH)
          end
        end
      end
    end
  rescue Zlib::Error, Gem::Package::TarInvalidError, Gem::Package::FormatError, ArgumentError
    raise Invalid, NOT_AN_EXPORT
  end
end
