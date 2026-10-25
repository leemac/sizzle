require "test_helper"
require "rubygems/package"
require "zlib"
require "active_support/testing/constant_stubbing"

class CookbookExportsControllerTest < ActionDispatch::IntegrationTest
  include ActiveSupport::Testing::ConstantStubbing

  def with_export_runner(runner)
    replacement = Class.new
    replacement.define_singleton_method(:new) { runner }
    stub_const(Object, :CookbookExportRunner, replacement) { yield }
  end
  # Transactional test data isn't visible to another process. Exercise the real
  # bounded writer here; runner tests and browser downloads cover the process.
  def post_export
    runner = Object.new
    runner.define_singleton_method(:build) { CookbookExport.new.build }
    with_export_runner(runner) { post cookbook_export_url }
  end

  test "exports saved and archived recipes, images and cooking history without import text or credentials" do
    recipe = Recipe.create!(title: "../../Kitchen notes", notes: "Less salt next time", rating: 4,
      ingredients: [ { "quantity" => 2, "unit" => "tbsp", "item" => "oil" } ],
      steps: [ { "text" => "Warm the oil" } ], favorited_at: Time.current, archived_at: Time.current)
    recipe.cooked!(at: 1.day.ago)
    bytes = sample_jpeg
    recipe.cover.attach(io: StringIO.new(bytes), filename: "../../.env.jpg", content_type: "image/jpeg")
    recipe.photos.attach(io: StringIO.new(bytes), filename: "unsafe.jpg", content_type: "image/jpeg")
    Import.create!(kind: "text", origin: "web", text: "PRIVATE IMPORT BODY")

    assert_no_difference([ "Recipe.count", "Import.count" ]) { post_export }
    assert_response :success
    assert_equal "application/gzip", response.media_type
    assert_includes response.headers["Content-Disposition"], "attachment"
    assert_includes response.headers["Cache-Control"], "no-store"
    entries = {}
    Zlib::GzipReader.wrap(StringIO.new(response.body)) do |gzip|
      Gem::Package::TarReader.new(gzip) { |tar| tar.each { |entry| entries[entry.full_name] = entry.read } }
    end
    manifest = JSON.parse(entries.fetch("cookbook.json"))
    assert_equal 1, manifest["format_version"]
    exported = manifest["recipes"].sole
    assert_equal recipe.title, exported["title"]
    assert_equal recipe.notes, exported["notes"]
    assert_equal recipe.rating, exported["rating"]
    assert exported["archived_at"]
    assert exported["favorited_at"]
    assert_equal 1, exported["cooks"].size
    assert_equal bytes, entries.fetch(exported["cover"])
    assert_equal bytes, entries.fetch(exported["photos"].sole)
    assert entries.keys.all? { |path| path.match?(%r{\A(?:README\.txt|cookbook\.json|recipes/\d+/(?:cover|photo-\d+)\.jpg)\z}) }
    assert_not_includes entries.fetch("cookbook.json"), "PRIVATE IMPORT BODY"
    assert_not_includes entries.fetch("cookbook.json"), "active_job_id"
  end

  test "export requires a CSRF token and GET cannot trigger it" do
    ActionController::Base.allow_forgery_protection = true
    post cookbook_export_url
    assert_response :unprocessable_content
    get cookbook_export_url
    assert_response :not_found
  ensure
    ActionController::Base.allow_forgery_protection = false
  end

  test "an empty cookbook still exports valid JSON" do
    post_export
    entries = {}
    Zlib::GzipReader.wrap(StringIO.new(response.body)) do |gzip|
      Gem::Package::TarReader.new(gzip) { |tar| tar.each { |entry| entries[entry.full_name] = entry.read } }
    end
    assert_equal [], JSON.parse(entries.fetch("cookbook.json"))["recipes"]
  end

  test "export failures return to settings with a useful error rather than a partial archive" do
    [ CookbookExport::TooLarge, CookbookExport::Expired, CookbookExport::Busy ].each do |error|
      runner = Object.new
      runner.define_singleton_method(:build) { raise error, "Export stopped safely." }
      with_export_runner(runner) { post cookbook_export_url }
      assert_response :see_other
      assert_redirected_to settings_url
      assert_equal "Export stopped safely.", flash[:alert]
      assert_nil response.headers["Content-Disposition"]
    end
  end
end
