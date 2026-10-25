require "test_helper"

class ImportServiceLoggingTest < ActiveSupport::TestCase
  test "download failures log categories without URLs or upstream error text" do
    output = StringIO.new
    previous = Rails.logger
    Rails.logger = ActiveSupport::Logger.new(output)
    marker = "synthetic-private-content"
    http = Object.new
    http.define_singleton_method(:get) { |*, **| raise SafeHttp::BadResponse, marker }

    assert_nil RecipeImages.new(http:).fetch_webp("https://example.com/image?token=#{marker}")
    video = YoutubeVideo.new("abcdefghijk", http:)
    assert_nil video.send(:linked_recipe_page, "Recipe: https://example.com/recipe?token=#{marker}")

    assert_includes output.string, "SafeHttp::BadResponse"
    assert_not_includes output.string, marker
    assert_not_includes output.string, "https://"
  ensure
    Rails.logger = previous
  end

  test "image decoder failures do not log attacker controlled diagnostics" do
    output = StringIO.new
    previous = Rails.logger
    Rails.logger = ActiveSupport::Logger.new(output)
    decoder = Vips::Image.method(:new_from_buffer)
    Vips::Image.define_singleton_method(:new_from_buffer) { |*| raise Vips::Error, "synthetic-private-content" }
    assert_nil RecipeImages.new.to_webp("GIF89a")
    assert_includes output.string, "Vips::Error"
    assert_not_includes output.string, "synthetic-private-content"
  ensure
    Vips::Image.define_singleton_method(:new_from_buffer, decoder) if decoder
    Rails.logger = previous
  end
end
