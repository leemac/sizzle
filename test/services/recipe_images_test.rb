require "test_helper"

class RecipeImagesTest < ActiveSupport::TestCase
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
