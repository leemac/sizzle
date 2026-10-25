require "test_helper"

class ImportBatchTest < ActiveSupport::TestCase
  include ActiveJob::TestHelper

  test "links on separate lines become one URL import each, without duplicates" do
    batch = ImportBatch.new("https://example.com/pie\n  https://example.com/cake \r\nhttps://example.com/pie", origin: "web")

    assert_enqueued_jobs 2, only: ImportJob do
      assert batch.save
    end
    assert_equal %w[https://example.com/pie https://example.com/cake], batch.imports.map(&:url)
    assert batch.imports.all? { |import| import.kind == "url" && import.origin == "web" && import.persisted? }
  end

  test "links separated by spaces work too" do
    assert_difference("Import.count", 2) { ImportBatch.new("https://example.com/pie https://example.com/cake", origin: "web").save }
  end

  test "one link or recipe text is a single import" do
    assert_equal [ "url" ], ImportBatch.new(" https://example.com/pie ", origin: "web").imports.map(&:kind)

    batch = ImportBatch.new("Apple pie\nhttps://example.com/pie\nBake the apples.", origin: "web")
    assert_equal [ "text" ], batch.imports.map(&:kind)
  end

  test "one bad link rejects the whole batch and names the link" do
    batch = ImportBatch.new("https://example.com/pie\nhttps://example.com:6379/cake", origin: "web")

    assert_no_enqueued_jobs do
      assert_no_difference("Import.count") { assert_not batch.save }
    end
    assert_equal "https://example.com:6379/cake: Url port 6379 is not allowed", batch.errors.full_messages.sole
  end

  test "every link is checked, not just the first" do
    [ "http://user:secret@example.com/pie", "https://example.com/#{'a' * 2048}" ].each do |bad|
      assert_no_difference("Import.count") do
        assert_not ImportBatch.new("https://example.com/ok\n#{bad}", origin: "web").save
      end
    end
  end

  test "pastes over the link limit are rejected without creating anything" do
    links = Array.new(ImportBatch::MAX_LINKS + 1) { |index| "https://example.com/#{index}" }.join("\n")
    batch = ImportBatch.new(links, origin: "web")

    assert_no_difference("Import.count") { assert_not batch.save }
    assert_equal "Paste up to 20 links at a time.", batch.errors.full_messages.sole
  end

  test "huge pastes don't build an import per link" do
    links = Array.new(5_000) { |index| "https://example.com/#{index}" }.join("\n")

    assert_equal ImportBatch::MAX_LINKS + 1, ImportBatch.new(links, origin: "web").imports.size
  end

  test "exactly the limit is allowed" do
    links = Array.new(ImportBatch::MAX_LINKS) { |index| "https://example.com/#{index}" }.join("\n")

    assert_difference("Import.count", ImportBatch::MAX_LINKS) { assert ImportBatch.new(links, origin: "web").save }
  end
end
