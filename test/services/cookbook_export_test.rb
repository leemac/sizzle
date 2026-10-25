require "test_helper"
require "active_support/testing/constant_stubbing"

class CookbookExportTest < ActiveSupport::TestCase
  include ActiveSupport::Testing::ConstantStubbing

  def reject_with_limit(name, value)
    stub_const(CookbookExport, name, value) do
      assert_raises(CookbookExport::TooLarge) { CookbookExport.new.build }
    end
  end

  test "recipe, photo and history counts are capped" do
    recipe = Recipe.create!(title: "A recipe")
    recipe.cooked!
    recipe.cover.attach(io: StringIO.new(sample_jpeg), filename: "photo.jpg", content_type: "image/jpeg")
    reject_with_limit(:MAX_RECIPES, 0)
    reject_with_limit(:MAX_PHOTOS, 0)
    reject_with_limit(:MAX_COOKS, 0)
  end

  test "oversized images and raw metadata are rejected before they are loaded" do
    recipe = Recipe.create!(title: "A recipe", notes: "x" * 100)
    recipe.cover.attach(io: StringIO.new(sample_jpeg), filename: "photo.jpg", content_type: "image/jpeg")
    reject_with_limit(:MAX_IMAGE_BYTES, 1)
    reject_with_limit(:MAX_BYTES, 1)
    reject_with_limit(:MAX_RECORD_BYTES, 10)
    reject_with_limit(:MAX_METADATA_BYTES, 10)
  end

  test "serialized escaping and generated metadata have independent limits" do
    Recipe.create!(title: "A recipe", notes: "\n" * 100)
    # The raw row fits, but JSON escaping takes it over the per-record budget.
    reject_with_limit(:MAX_RECORD_BYTES, 500)
    reject_with_limit(:MAX_METADATA_BYTES, 500)
  end

  test "actual attachment size is checked while streaming rather than trusting blob metadata" do
    recipe = Recipe.create!(title: "A recipe")
    recipe.cover.attach(io: StringIO.new(sample_jpeg), filename: "photo.jpg", content_type: "image/jpeg")
    blob = recipe.cover.blob
    blob.update_columns(byte_size: blob.byte_size - 1)
    assert_raises(CookbookExport::Error) { CookbookExport.new.build }
  end

  test "streaming preserves the original attachment checksum check" do
    recipe = Recipe.create!(title: "A recipe")
    recipe.cover.attach(io: StringIO.new(sample_jpeg), filename: "photo.jpg", content_type: "image/jpeg")
    blob = recipe.cover.blob
    blob.service.upload(blob.key, StringIO.new("x" * blob.byte_size))
    error = assert_raises(CookbookExport::Error) { CookbookExport.new.build }
    assert_match "integrity check", error.message
  end

  test "partial downloads release the lock and remove the archive" do
    Dir.mktmpdir do |directory|
      file = Tempfile.new("archive-", directory)
      file.write("x" * 100_000)
      file.flush
      path = file.path
      lock = File.open(File.join(directory, "lock"), "w")
      lock.flock(File::LOCK_EX)
      download = CookbookExport::Download.new(file, lock:)
      download.each { |chunk| break if chunk.present? }
      assert_not File.exist?(path)
      assert lock.closed?
      assert_nothing_raised { download.close }
    end
  end

  test "a stalled download is interrupted and still releases its file and lock" do
    Dir.mktmpdir do |directory|
      file = Tempfile.new("archive-", directory)
      file.write("archive bytes")
      file.flush
      path = file.path
      lock = File.open(File.join(directory, "lock"), "w")
      lock.flock(File::LOCK_EX)
      download = CookbookExport::Download.new(file, lock:, seconds: 0.05)
      started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      assert_raises(CookbookExport::Expired) { download.each { sleep 5 } }
      assert_operator Process.clock_gettime(Process::CLOCK_MONOTONIC) - started, :<, 1
      assert_not File.exist?(path)
      assert lock.closed?
    end
  end

  test "a blocked socket-like write cannot hold the download open indefinitely" do
    reader, writer = IO.pipe
    file = Tempfile.new("sizzle-export-transfer-")
    file.write("x" * 2.megabytes)
    file.flush
    path = file.path
    download = CookbookExport::Download.new(file, seconds: 0.05)
    assert_raises(CookbookExport::Expired) { download.each { |chunk| writer.write(chunk) } }
    assert_not File.exist?(path)
  ensure
    reader&.close
    writer&.close
    file&.close!
  end

  test "a killed export child cannot leave its manifest in the temporary directory" do
    Dir.mktmpdir do |directory|
      reader, writer = IO.pipe
      builder = Class.new(CookbookExport) do
        define_method(:write_metadata) do |file, _text|
          file.write("x" * 1.megabyte)
          file.flush
          writer.puts({ path: file.path, links: file.stat.nlink }.to_json)
          writer.close
          sleep
        end
      end
      pid = fork do
        reader.close
        ENV["TMPDIR"] = directory
        # Stop at the first actual manifest write, before reading any records.
        builder.new.send(:write_cookbook, nil)
      end
      writer.close
      manifest = JSON.parse(Timeout.timeout(5) { reader.gets })
      assert_equal directory, File.dirname(manifest.fetch("path"))
      assert_equal 0, manifest.fetch("links"), "the manifest must be anonymous before generation continues"
      assert_empty Dir.children(directory)
      Process.kill("KILL", pid)
      Timeout.timeout(5) { Process.wait(pid) }
      pid = nil
      assert_empty Dir.children(directory), "SIGKILL must not leave a named manifest behind"
    ensure
      reader&.close unless reader&.closed?
      writer&.close unless writer&.closed?
      if pid
        Process.kill("KILL", pid)
        Process.wait(pid)
      end
    end
  end
end
