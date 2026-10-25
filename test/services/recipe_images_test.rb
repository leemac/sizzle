require "test_helper"

class RecipeImagesTest < ActiveSupport::TestCase
  test "cover fallbacks stop when their shared download deadline expires" do
    now = 100.0
    calls = []
    http = Object.new
    http.define_singleton_method(:get) do |url, **options|
      calls << [ url, options[:deadline] ]
      now += RecipeImages::DOWNLOAD_SECONDS
      raise SafeHttp::DeadlineExceeded
    end
    images = RecipeImages.new(http:)
    images.define_singleton_method(:monotonic_time) { now }
    urls = Array.new(20) { |i| "https://example.com/#{i}.jpg" }

    images.attach(Object.new, cover_urls: urls, photo_urls: urls)

    assert_equal [ [ urls.first, 130.0 ] ], calls
  end

  test "cover and step photos share a bounded number of download attempts" do
    calls = []
    http = Object.new
    http.define_singleton_method(:get) do |url, **options|
      calls << options
      SafeHttp::Response.new(url:, status: 200, content_type: "image/jpeg", body: "not an image")
    end
    images = RecipeImages.new(http:)
    urls = Array.new(20) { |i| "https://example.com/#{i}.jpg" }

    # Failed images still spend the budget, including across the two loops.
    images.attach(Object.new, cover_urls: urls.first(5), photo_urls: urls.drop(5))

    assert_equal RecipeImages::MAX_DOWNLOADS, calls.size
    assert_equal 1, calls.map { |options| options[:deadline] }.uniq.size
    assert calls.all? { |options| options[:max_bytes] == RecipeImages::MAX_DOWNLOAD_BYTES }
  end

  test "rejects excessive dimensions and pixel counts in compressed PNGs before resizing" do
    # These PNG headers advertise enormous images but contain only tiny pixel data.
    # They must be rejected by header inspection, before asking libvips to decode.
    [ [ 20_000, 400 ], [ 400, 20_000 ], [ 8_000, 8_000 ] ].each do |width, height|
      png = Vips::Image.black(1, 1).cast(:uchar).pngsave_buffer
      png[16, 8] = [ width, height ].pack("NN")
      png[29, 4] = [ Zlib.crc32(png[12, 17]) ].pack("N")
      assert_nil RecipeImages.new.to_webp(png)
    end
  end

  test "reencodes a normal image and rejects an undersized one" do
    bytes = RecipeImages.new.to_webp(sample_jpeg)
    assert bytes.start_with?("RIFF")
    assert_nil RecipeImages.new.to_webp(sample_jpeg(width: 100, height: 100))
  end

  test "boot enables the libvips guard even with an unsafe inherited value" do
    require "open3"
    [ nil, "0" ].each do |inherited|
      stdout, status = Open3.capture2({ "VIPS_BLOCK_UNTRUSTED" => inherited },
                                     RbConfig.ruby, "-r", Rails.root.join("config/boot.rb").to_s,
                                     "-e", 'print ENV.fetch("VIPS_BLOCK_UNTRUSTED")')
      assert status.success?
      assert_equal "1", stdout
    end
  end
end
