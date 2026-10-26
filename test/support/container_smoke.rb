# Run only in a disposable production container after its normal entrypoint boots:
# docker exec -i sizzle ./bin/docker-entrypoint ./bin/rails runner - < test/support/container_smoke.rb
require "stringio"

abort "Unexpected Ruby version" unless RUBY_VERSION == Rails.root.join(".ruby-version").read.strip
abort "Container is running as root" if Process.euid.zero?
abort "Untrusted image loaders are enabled" unless ENV["VIPS_BLOCK_UNTRUSTED"] == "1"
abort "jemalloc is not loaded" unless File.read("/proc/self/maps").include?("libjemalloc")
abort "Privilege escalation is enabled" unless File.read("/proc/self/status").match?(/^NoNewPrivs:\s+1$/)

begin
  File.open(Rails.root.join("Gemfile"), File::WRONLY | File::APPEND).close
  abort "Container root filesystem is writable"
rescue Errno::EROFS
  # Expected: application code is read-only, storage and temporary directories are writable.
end

recipe = Recipe.create!(title: "Container smoke recipe")
abort "SQLite write/read failed" unless Recipe.find(recipe.id).title == recipe.title
jpeg = Vips::Image.black(16, 16, bands: 3).cast(:uchar).jpegsave_buffer
recipe.cover.attach(io: StringIO.new(jpeg), filename: "smoke.jpg", content_type: "image/jpeg")
webp = recipe.cover.variant(resize_to_limit: [ 8, 8 ], format: :webp).processed.download
abort "WebP conversion failed" unless webp.start_with?("RIFF") && webp.byteslice(8, 4) == "WEBP"
image = Vips::Image.new_from_buffer(webp, "")
abort "Image resize failed" unless image.width == 8 && image.height == 8
recipe.cover.purge
recipe.destroy!
puts "Container smoke passed: Ruby #{RUBY_VERSION}, SQLite, WebP variants, jemalloc and container hardening"
