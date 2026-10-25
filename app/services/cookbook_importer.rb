# Adds the recipes in an uploaded cookbook export, with their photos, notes and
# cooking history. A recipe you already have is skipped and counted, never
# changed, so importing the same file twice adds nothing the second time.
class CookbookImporter
  PROGRESS_EVERY = 25
  FAILED = "Something went wrong partway through. Recipes imported before then were kept; " \
    "importing the same file again adds the rest."

  def initialize(cookbook_import, images: RecipeImages.new)
    @cookbook_import = cookbook_import
    @images = images
    @counts = { imported_count: 0, skipped_count: 0, rejected_count: 0 }
    @cooks = 0
  end

  def run
    @cookbook_import.update!(status: "running")
    @cookbook_import.archive.open do |file|
      archive = CookbookArchive.new(file.path)
      seen = Seen.new
      owners = {}
      entries = archive.recipes.filter_map { |data| accept(CookbookRecipe.new(data), seen, owners) }
      # Photos are converted before any recipe is saved, then attached in the
      # same transaction as their recipe. A recipe is never saved without its
      # photos, so importing again after a failure finishes the job.
      Tempfile.create([ "sizzle-cookbook-photos-", ".bin" ], binmode: true) do |store|
        photos = convert_photos(archive, owners.keys.to_set, store)
        entries.each_with_index do |entry, index|
          save(entry, owners, photos, store)
          heartbeat(index)
        end
      end
    end
    @cookbook_import.update!(**@counts, status: "done", finished_at: Time.current)
  rescue CookbookArchive::Invalid => e
    @cookbook_import.update!(**@counts, status: "failed", error: e.message, finished_at: Time.current)
  rescue StandardError => e
    @cookbook_import.update!(**@counts, status: "failed", error: FAILED, finished_at: Time.current)
    raise e
  ensure
    @cookbook_import.archive.purge if @cookbook_import.archive.attached?
  end

  private

  # The recipes to add: valid, and not one already here or earlier in the file.
  def accept(entry, seen, owners)
    unless entry.valid?
      @counts[:rejected_count] += 1
      return
    end
    keys = Seen.keys(entry.attributes)
    if seen.any?(keys)
      @counts[:skipped_count] += 1
      return
    end
    seen.add(keys)
    # Each photo in the file is used once: by one recipe, as its cover or a step photo.
    owners[entry.cover_path] ||= [ entry, :cover ] if entry.cover_path
    entry.photo_paths.each { |path| owners[path] ||= [ entry, :photo ] }
    entry
  end

  # Photos are re-checked and re-encoded like any downloaded image. The WebP
  # bytes wait in one temporary file, found by offset, never by archive name.
  def convert_photos(archive, paths, store)
    photos = {}
    archive.each_image(paths) do |path, bytes|
      webp = @images.to_webp(bytes) or next
      photos[path] = [ store.pos, webp.bytesize ]
      store.write(webp)
      heartbeat(photos.size - 1)
    end
    store.flush
    photos
  end

  def save(entry, owners, photos, store)
    cooked_at = entry.cooked_at.first([ CookbookExport::MAX_COOKS - @cooks, 0 ].max)
    owned = ->(path, role) { path if owners[path]&.first.equal?(entry) && owners[path].last == role && photos.key?(path) }
    read = ->(path) { StringIO.new(store.pread(photos[path].last, photos[path].first)) }
    Recipe.transaction do
      recipe = Recipe.create!(entry.attributes)
      now = Time.current
      Cook.insert_all!(cooked_at.map { |at| { recipe_id: recipe.id, cooked_at: at, created_at: now, updated_at: now } }) if cooked_at.any?
      recipe.update_column(:cooks_count, cooked_at.size)
      if (cover = owned.(entry.cover_path, :cover))
        recipe.cover.attach(io: read.(cover), filename: "cover.webp", content_type: "image/webp")
      end
      entry.photo_paths.filter_map { |path| owned.(path, :photo) }.each_with_index do |path, index|
        recipe.photos.attach(io: read.(path), filename: "photo-#{index + 1}.webp", content_type: "image/webp")
      end
    end
    @cooks += cooked_at.size
    @counts[:imported_count] += 1
  rescue ActiveRecord::RecordNotUnique
    @counts[:skipped_count] += 1
  rescue ActiveRecord::RecordInvalid
    @counts[:rejected_count] += 1
  end

  # Saves progress now and then, which also shows the import hasn't stalled.
  def heartbeat(index)
    @cookbook_import.update!(@counts) if (index + 1) % PROGRESS_EVERY == 0
  end

  # Every signature of the recipes already here and those added so far.
  class Seen
    def self.keys(attributes)
      [ [ :uid, attributes[:uid] ],
        [ :url, attributes[:source_url] && RecipeSignature.url_key(attributes[:source_url]) ],
        [ :content, RecipeSignature.fingerprint(attributes[:title], attributes[:ingredients]) ] ].select(&:last)
    end

    def initialize
      @keys = Set.new
      Recipe.select(:id, :uid, :source_url, :title, :ingredients).find_each do |recipe|
        add(self.class.keys(recipe.attributes.symbolize_keys))
      end
    end

    def any?(keys)
      keys.any? { |key| @keys.include?(key) }
    end

    def add(keys)
      @keys.merge(keys)
    end
  end
end
