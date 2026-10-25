require "test_helper"

class ReleaseNotesTest < ActiveSupport::TestCase
  test "the backfill is ordered, unique, dated and complete" do
    releases = ReleaseNotes.all
    versions = releases.map { |release| release.fetch("version") }
    %w[0.3.1 0.3.0 0.2.0 0.1.0 0.0.1].each { |version| assert_includes versions, version }
    assert_equal versions.uniq, versions
    assert_equal versions.sort_by { |v| Gem::Version.new(v) }.reverse, versions
    releases.each do |release|
      assert_match(/\A\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?\z/, release.fetch("version"))
      Date.iso8601(release.fetch("date"))
      %w[title summary highlights sections].each { |key| assert release.fetch(key).present? }
      release.fetch("sections").each { |section| assert section.fetch("paragraphs").all?(&:present?) }
    end
  end

  test "only notes included in the running version are offered" do
    assert_equal %w[0.1.0 0.0.1], ReleaseNotes.available("0.1.0").map { |release| release["version"] }
    assert_equal "0.2.0", ReleaseNotes.available("0.3.0-rc.1").first["version"]
    assert_empty ReleaseNotes.available("0.0.0")
    assert_empty ReleaseNotes.available("unknown-build")
    assert_equal ReleaseNotes.all, ReleaseNotes.available("dev")
  end
end
