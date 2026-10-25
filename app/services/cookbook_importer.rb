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
      wanted = {}
      seen = Seen.new
      archive.recipes.each_with_index do |data, index|
        add(CookbookRecipe.new(data), seen, wanted)
        @cookbook_import.update!(@counts) if (index + 1) % PROGRESS_EVERY == 0
      end
      attach_images(archive, wanted)
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

  def add(entry, seen, wanted)
    return @counts[:rejected_count] += 1 unless entry.valid?

    attributes = entry.attributes
    keys = Seen.keys(attributes)
    return @counts[:skipped_count] += 1 if seen.any?(keys)

    cooked_at = entry.cooked_at.first([ CookbookExport::MAX_COOKS - @cooks, 0 ].max)
    recipe = Recipe.transaction do
      Recipe.create!(attributes).tap do |saved|
        now = Time.current
        Cook.insert_all!(cooked_at.map { |at| { recipe_id: saved.id, cooked_at: at, created_at: now, updated_at: now } }) if cooked_at.any?
        saved.update_column(:cooks_count, cooked_at.size)
      end
    end
    @cooks += cooked_at.size
    seen.add(Seen.keys(recipe.attributes.symbolize_keys))
    @counts[:imported_count] += 1
    # Each photo in the file belongs to at most one recipe.
    wanted[entry.cover_path] ||= [ recipe, :cover ] if entry.cover_path
    entry.photo_paths.each { |path| wanted[path] ||= [ recipe, :photo ] }
  rescue ActiveRecord::RecordNotUnique
    @counts[:skipped_count] += 1
  rescue ActiveRecord::RecordInvalid
    @counts[:rejected_count] += 1
  end

  # Photos are re-checked and re-encoded like any downloaded image.
  def attach_images(archive, wanted)
    archive.each_image(wanted.keys.to_set) do |path, bytes|
      recipe, role = wanted.fetch(path)
      webp = @images.to_webp(bytes) or next
      if role == :cover
        recipe.cover.attach(io: StringIO.new(webp), filename: "cover.webp", content_type: "image/webp")
      else
        recipe.photos.attach(io: StringIO.new(webp), filename: "photo-#{recipe.photos.count + 1}.webp", content_type: "image/webp")
      end
    end
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
