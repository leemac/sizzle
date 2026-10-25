require "test_helper"
require "rubygems/package"
require "zlib"

class CookbookImporterTest < ActiveSupport::TestCase
  # A tar.gz built entry by entry, so tests can include hostile names and types.
  def archive(entries)
    tar = StringIO.new("".b)
    Gem::Package::TarWriter.new(tar) do |writer|
      entries.each do |name, body, type|
        case type
        when :symlink then writer.add_symlink(name, body, 0o777)
        when :directory then writer.mkdir(name, 0o755)
        else writer.add_file_simple(name, 0o644, body.bytesize) { |io| io.write(body) }
        end
      end
    end
    gzip = StringIO.new("".b)
    Zlib::GzipWriter.wrap(gzip) { |writer| writer.write(tar.string) }
    gzip.string
  end

  def manifest(recipes, version: 1)
    [ "cookbook.json", { format_version: version, exported_at: Time.current.iso8601, recipes: }.to_json ]
  end

  def run_import(bytes)
    cookbook_import = CookbookImport.create!(archive: { io: StringIO.new(bytes), filename: "cookbook.tar.gz", content_type: "application/gzip" })
    CookbookImporter.new(cookbook_import).run
    cookbook_import.reload
  end

  def exported_cookbook
    download = CookbookExport.new.build
    "".b.tap { |bytes| download.each { |chunk| bytes << chunk } }
  end

  def recipe_data(**overrides)
    { "title" => "Lemon pie", "ingredients" => [ { "item" => "lemons", "quantity" => 3 }, { "item" => "sugar" } ],
      "steps" => [ { "text" => "Bake." } ] }.merge(overrides.stringify_keys)
  end

  test "an export round-trips with its photos, notes, dates and cooking history" do
    recipe = Recipe.create!(title: "Kitchen sink cookies", notes: "Less salt next time", rating: 4,
      source_url: "https://example.com/cookies", source_name: "Example Kitchen",
      ingredients: [ { "quantity" => 2, "unit" => "cups", "item" => "flour" } ], steps: [ { "text" => "Mix." } ],
      tips: Array.new(8) { |index| "Tip #{index}" }, favorited_at: 2.days.ago, archived_at: 1.day.ago,
      meal_times: [], seasons: %w[winter], created_at: 1.year.ago)
    recipe.cooked!(at: 3.days.ago)
    recipe.cooked!(at: 1.day.ago)
    recipe.cover.attach(io: StringIO.new(sample_jpeg), filename: "cover.jpg", content_type: "image/jpeg")
    recipe.photos.attach(io: StringIO.new(sample_jpeg), filename: "step.jpg", content_type: "image/jpeg")
    bytes = exported_cookbook
    original = recipe.attributes.slice(*%w[uid title notes rating source_url source_name tips meal_times seasons])
    recipe.destroy!

    result = run_import(bytes)

    assert_equal [ "done", 1, 0, 0 ], [ result.status, result.imported_count, result.skipped_count, result.rejected_count ]
    restored = Recipe.sole
    assert_equal original, restored.attributes.slice(*original.keys)
    assert_equal [ { "quantity" => 2, "unit" => "cups", "item" => "flour" } ], restored.ingredients.map(&:compact)
    assert restored.favorite?
    assert restored.archived?
    assert_in_delta 1.year.ago, restored.created_at, 1.minute
    assert_equal 2, restored.cooks.count
    assert_equal 2, restored.cooks_count
    assert restored.cover.attached?
    assert_equal "image/webp", restored.cover.content_type
    assert_equal 1, restored.photos.count
    assert_not result.archive.attached?, "the upload is deleted once imported"
  end

  test "importing the same cookbook twice adds nothing the second time" do
    Recipe.create!(title: "Soup", ingredients: [ { "item" => "leeks" } ], steps: [ { "text" => "Simmer." } ])
    bytes = exported_cookbook

    result = run_import(bytes)

    assert_equal [ 0, 1 ], [ result.imported_count, result.skipped_count ]
    assert_equal 1, Recipe.count
  end

  test "recipes already here are recognized by uid, source page, or title and ingredients" do
    existing = Recipe.create!(title: "Lemon Pie!", source_url: "https://www.example.com/pie/",
      ingredients: [ { "item" => "Sugar" }, { "item" => "lemons", "quantity" => 5 } ], steps: [ { "text" => "Bake." } ])
    bytes = archive([ manifest([
      recipe_data("uid" => existing.uid, "title" => "Renamed after editing", "ingredients" => [ { "item" => "limes" } ]),
      recipe_data("title" => "Pie from another link", "source_url" => "http://example.com/pie?utm_source=feed",
        "ingredients" => [ { "item" => "apples" } ]),
      recipe_data("title" => "lemon pie", "source_url" => "https://other.example/lemon-pie"),
      recipe_data("title" => "Lemon pie", "ingredients" => [ { "item" => "lemons" }, { "item" => "cream" } ])
    ]) ])

    result = run_import(bytes)

    assert_equal [ 1, 3 ], [ result.imported_count, result.skipped_count ]
    assert_equal [ "cream", "lemons" ], Recipe.last.ingredients.map { |line| line["item"] }.sort,
      "a different ingredient list is a different recipe"
  end

  test "duplicates inside one file are imported once" do
    bytes = archive([ manifest([ recipe_data, recipe_data("uid" => SecureRandom.uuid), recipe_data("title" => "LEMON PIE") ]) ])

    result = run_import(bytes)

    assert_equal [ 1, 2 ], [ result.imported_count, result.skipped_count ]
  end

  test "hostile recipe fields are clamped, dropped or replaced" do
    bytes = archive([ manifest([
      recipe_data("uid" => "../../not-a-uuid", "source_url" => "javascript:alert(1)", "rating" => 9,
        "notes" => "n" * 20_000, "course" => "poison", "diets" => %w[vegan carnivore], "tags" => Array.new(50) { |index| "tag#{index}" },
        "favorited_at" => 10.years.from_now.iso8601, "archived_at" => "not a date", "created_at" => "1900-01-01T00:00:00Z",
        "cooks" => [ { "cooked_at" => 1.day.from_now.iso8601 + "x" }, "nope", { "cooked_at" => 2.days.ago.iso8601 } ] * 3,
        "id" => 1, "cooks_count" => 999, "imports" => [ { "text" => "PRIVATE" } ]),
      recipe_data("title" => "   "),
      "not a recipe"
    ]) ])

    result = run_import(bytes)

    assert_equal [ 1, 1 ], [ result.imported_count, result.rejected_count ]
    recipe = Recipe.sole
    assert_match CookbookRecipe::UID, recipe.uid
    assert_nil recipe.source_url
    assert_nil recipe.rating
    assert_equal RecipeEdit::MAX_NOTES_LENGTH, recipe.notes.length
    assert_nil recipe.course
    assert_equal %w[vegan], recipe.diets
    assert_equal RecipeDraft::MAX_TAGS, recipe.tags.size
    assert_nil recipe.favorited_at
    assert_nil recipe.archived_at
    assert_in_delta Time.current, recipe.created_at, 1.minute
    assert_equal 1, recipe.cooks.count
    assert_equal 1, recipe.cooks_count
  end

  test "only allowlisted regular files are read, and photos must be real images" do
    bytes = archive([
      [ "recipes/1/cover.webp", "-> /etc/passwd", :symlink ],
      [ "../../config/master.key", "secret" ],
      [ "/etc/cron.d/sizzle", "* * * * * root sh" ],
      [ "recipes/2", nil, :directory ],
      [ "recipes/2/cover.jpg", "<svg onload=alert(1)>" ],
      [ "recipes/3/cover.jpg", sample_jpeg ],
      manifest([
        recipe_data("title" => "Symlinked", "cover" => "recipes/1/cover.webp"),
        recipe_data("title" => "Escaping", "ingredients" => [ { "item" => "x" } ], "cover" => "../../config/master.key"),
        recipe_data("title" => "Not an image", "ingredients" => [ { "item" => "y" } ], "cover" => "recipes/2/cover.jpg"),
        recipe_data("title" => "Real photo", "ingredients" => [ { "item" => "z" } ], "cover" => "recipes/3/cover.jpg",
          "photos" => [ "recipes/3/cover.jpg" ])
      ])
    ])

    result = run_import(bytes)

    assert_equal [ "done", 4 ], [ result.status, result.imported_count ]
    assert_equal [ "Real photo" ], Recipe.joins(:cover_attachment).pluck(:title)
    assert_equal 0, Recipe.find_by!(title: "Real photo").photos.count, "one photo in the file belongs to one recipe"
    assert_not File.exist?(Rails.root.join("config/master.key.imported"))
  end

  test "files that aren't a usable export fail with a clear message and are deleted" do
    {
      "not gzip at all" => CookbookArchive::NOT_AN_EXPORT,
      archive([ [ "README.txt", "hello" ] ]) => CookbookArchive::NOT_AN_EXPORT,
      archive([ [ "cookbook.json", "{not json" ] ]) => CookbookArchive::NOT_AN_EXPORT,
      archive([ [ "cookbook.json", "[]" ] ]) => CookbookArchive::NOT_AN_EXPORT,
      archive([ manifest([]), manifest([]) ]) => CookbookArchive::NOT_AN_EXPORT,
      archive([ manifest([ recipe_data ], version: 2) ]) => "newer version of Sizzle",
      archive([ [ "cookbook.json", ("[" * 100) + ("]" * 100) ] ]) => CookbookArchive::NOT_AN_EXPORT
    }.each do |bytes, message|
      result = run_import(bytes)
      assert_equal "failed", result.status
      assert_includes result.error, message
      assert_not result.archive.attached?
    end
    assert_equal 0, Recipe.count
  end

  test "archives over the entry or expanded size limits are refused before they're read" do
    many = archive(Array.new(CookbookArchive::MAX_ENTRIES + 1) { |index| [ "pad-#{index}", "" ] } + [ manifest([ recipe_data ]) ])
    assert_equal CookbookArchive::TOO_LARGE, run_import(many).error

    stub_const(CookbookArchive, :MAX_EXPANDED_BYTES, 1.kilobyte) do
      big = archive([ [ "padding", "0" * 2.kilobytes ], manifest([ recipe_data ]) ])
      assert_equal CookbookArchive::TOO_LARGE, run_import(big).error
    end
    assert_equal 0, Recipe.count
  end

  def two_recipes_with_photos
    archive([ [ "recipes/1/cover.jpg", sample_jpeg ], [ "recipes/2/cover.jpg", sample_jpeg ],
      manifest([ recipe_data("title" => "First", "cover" => "recipes/1/cover.jpg", "cooks" => [ { "cooked_at" => 1.day.ago.iso8601 } ]),
        recipe_data("title" => "Second", "ingredients" => [ { "item" => "pears" } ], "cover" => "recipes/2/cover.jpg",
          "cooks" => [ { "cooked_at" => 2.days.ago.iso8601 } ]) ]) ])
  end

  def importing(bytes, **options)
    cookbook_import = CookbookImport.create!(archive: { io: StringIO.new(bytes), filename: "cookbook.tar.gz", content_type: "application/gzip" })
    CookbookImporter.new(cookbook_import, **options).run
  ensure
    cookbook_import&.reload
  end

  test "a failure while converting photos saves nothing, so importing again adds every recipe with its photo" do
    images = Object.new
    images.define_singleton_method(:to_webp) { |_bytes| raise "disk full" }
    bytes = two_recipes_with_photos

    assert_raises(RuntimeError) { importing(bytes, images:) }

    failed = CookbookImport.sole
    assert_equal [ "failed", 0 ], [ failed.status, failed.imported_count ]
    assert_equal CookbookImporter::FAILED, failed.error
    assert_not failed.archive.attached?
    assert_equal 0, Recipe.count

    retried = run_import(bytes)
    assert_equal [ "done", 2 ], [ retried.status, retried.imported_count ]
    assert Recipe.all.all? { |recipe| recipe.cover.attached? }
  end

  test "a failure partway through keeps finished recipes whole, and importing again adds the rest with photos" do
    calls = 0
    insert = Cook.method(:insert_all!)
    Cook.define_singleton_method(:insert_all!) { |*args, **options| (calls += 1) == 2 ? raise("database locked") : insert.call(*args, **options) }
    bytes = two_recipes_with_photos

    assert_raises(RuntimeError) { importing(bytes) }
    Cook.singleton_class.remove_method(:insert_all!)

    assert_equal [ "First" ], Recipe.pluck(:title), "the recipe that failed was rolled back with its photo"
    assert Recipe.sole.cover.attached?
    retried = run_import(bytes)
    assert_equal [ 1, 1 ], [ retried.imported_count, retried.skipped_count ]
    second = Recipe.find_by!(title: "Second")
    assert second.cover.attached?
    assert_equal 1, second.cooks_count
  ensure
    Cook.singleton_class.remove_method(:insert_all!) if Cook.singleton_methods(false).include?(:insert_all!)
  end

  include ActiveSupport::Testing::ConstantStubbing
end
