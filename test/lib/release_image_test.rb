require "test_helper"
require_relative "../../.github/scripts/release_image"

class ReleaseImageTest < ActiveSupport::TestCase
  IMAGE = "ghcr.io/leemac/sizzle"
  REVISION = "a" * 40
  ORIGINAL = "sha256:#{'1' * 64}"
  REBUILT = "sha256:#{'2' * 64}"
  PLATFORMS = [ "sha256:#{'3' * 64}", "sha256:#{'4' * 64}" ]
  Status = Struct.new(:success?)

  setup do
    @registry = {}
    @writes = []
    @errors = {}
  end

  test "first release creates its exact tag then promotes the same digest" do
    release = publisher("0.0.1")
    digest = release.prepare(digests: PLATFORMS, annotations: [])

    assert_equal REBUILT, digest
    assert_equal [ "0.0.1" ], @writes
    assert release.promote(digest: digest)
    assert_equal [ "0.0.1", "latest", "0.0" ], @writes
    assert_equal digest, @registry.fetch("latest").fetch("digest")
  end

  test "retry keeps the original exact digest despite different rebuilt images" do
    @registry["0.0.1"] = manifest("0.0.1")
    release = publisher("0.0.1")

    assert_equal ORIGINAL, release.prepare(digests: PLATFORMS, annotations: [])
    assert_empty @writes
    assert release.promote(digest: ORIGINAL)
    assert_equal ORIGINAL, @registry.fetch("0.0").fetch("digest")
    assert_equal ORIGINAL, @registry.fetch("0.0.1").fetch("digest")
  end

  test "a reused version pointing at another commit is rejected" do
    @registry["0.0.1"] = manifest("0.0.1", revision: "b" * 40)

    assert_raises(RuntimeError) { publisher("0.0.1").prepare(digests: PLATFORMS, annotations: []) }
    assert_empty @writes
  end

  test "missing or mismatched exact-version identity cannot be reused" do
    [ {}, { "org.opencontainers.image.version" => "0.0.2", "org.opencontainers.image.revision" => REVISION } ].each do |notes|
      @registry["0.0.1"] = { "digest" => ORIGINAL, "annotations" => notes }
      assert_raises(RuntimeError) { publisher("0.0.1").prepare(digests: PLATFORMS, annotations: []) }
      assert_empty @writes
    end
  end

  test "release identity overrides metadata defaults" do
    notes = [ "index:org.opencontainers.image.version=wrong", "index:org.opencontainers.image.revision=wrong", "index:org.opencontainers.image.title=Sizzle" ]
    publisher("0.0.1").prepare(digests: PLATFORMS, annotations: notes)

    assert_equal manifest("0.0.1", digest: REBUILT).fetch("annotations"), @registry.fetch("0.0.1").fetch("annotations").except("org.opencontainers.image.title")
    assert_equal "Sizzle", @registry.fetch("0.0.1").fetch("annotations").fetch("org.opencontainers.image.title")
  end

  test "an older release finishing later cannot downgrade any floating tag" do
    @registry["1.2.3"] = manifest("1.2.3")
    %w[latest 1.2 1].each { |tag| @registry[tag] = manifest("1.2.4", digest: REBUILT) }

    assert_not publisher("1.2.3").promote(digest: ORIGINAL)
    assert_empty @writes
  end

  test "backport advances its minor tag without downgrading latest or major" do
    @registry["1.2.4"] = manifest("1.2.4")
    @registry["1.2"] = manifest("1.2.3", digest: REBUILT)
    %w[latest 1].each { |tag| @registry[tag] = manifest("1.3.0", digest: REBUILT) }

    assert_not publisher("1.2.4").promote(digest: ORIGINAL)
    assert_equal [ "1.2" ], @writes
  end

  test "version comparison is numeric" do
    @registry["0.0.10"] = manifest("0.0.10")
    %w[latest 0.0].each { |tag| @registry[tag] = manifest("0.0.9", digest: REBUILT) }

    assert publisher("0.0.10").promote(digest: ORIGINAL)
    assert_equal %w[latest 0.0], @writes
  end

  test "prereleases publish only the exact version" do
    release = publisher("1.2.3-rc.1")
    digest = release.prepare(digests: PLATFORMS, annotations: [])

    assert_not release.promote(digest: digest)
    assert_equal [ "1.2.3-rc.1" ], @writes
  end

  test "an unchanged retry of latest is safe" do
    %w[1.2.3 latest 1.2 1].each { |tag| @registry[tag] = manifest("1.2.3") }

    assert publisher("1.2.3").promote(digest: ORIGINAL)
    assert_equal ORIGINAL, @registry.fetch("latest").fetch("digest")
  end

  test "registry failures never authorize replacing an exact tag" do
    [ "403 Forbidden", "request timed out", "unexpected status: 500", "not found: authorization service" ].each do |error|
      @errors["0.0.1"] = error
      assert_raises(RuntimeError) { publisher("0.0.1").prepare(digests: PLATFORMS, annotations: []) }
      assert_empty @writes
    end
  end

  test "unknown floating version metadata stops promotion before any writes" do
    @registry["1.2.3"] = manifest("1.2.3")
    @registry["1.2"] = { "digest" => REBUILT }

    assert_raises(RuntimeError) { publisher("1.2.3").promote(digest: ORIGINAL) }
    assert_empty @writes
  end

  test "registry failure on a floating tag stops promotion before any writes" do
    @registry["1.2.3"] = manifest("1.2.3")
    @errors["1"] = "request timed out"

    assert_raises(RuntimeError) { publisher("1.2.3").promote(digest: ORIGINAL) }
    assert_empty @writes
  end

  test "a conflicting digest for the same version stops promotion" do
    @registry["0.0.1"] = manifest("0.0.1")
    @registry["latest"] = manifest("0.0.1", digest: REBUILT)

    assert_raises(RuntimeError) { publisher("0.0.1").promote(digest: ORIGINAL) }
    assert_empty @writes
  end

  test "promotion rejects a digest other than the exact release" do
    @registry["0.0.1"] = manifest("0.0.1")

    assert_raises(RuntimeError) { publisher("0.0.1").promote(digest: REBUILT) }
    assert_empty @writes
  end

  test "invalid versions and platform digests cannot reach a write" do
    [ "01.2.3", "1.2.3-rc..1", "1.2.3-01", "1.2.3; touch /tmp/unsafe" ].each do |version|
      assert_raises(ArgumentError) { publisher(version) }
    end
    [ [], [ ORIGINAL ], [ ORIGINAL, ORIGINAL ], [ ORIGINAL, "--tag=unsafe" ] ].each do |digests|
      assert_raises(ArgumentError) { publisher("0.0.1").prepare(digests: digests, annotations: []) }
    end
    assert_empty @writes
  end

  test "workflow serializes versions and attests before advancing floating tags" do
    workflow = YAML.load_file(Rails.root.join(".github/workflows/release.yml"))

    assert_equal "release-${{ github.repository }}", workflow.fetch("concurrency").fetch("group")
    assert_equal "max", workflow.fetch("concurrency").fetch("queue")
    assert_equal false, workflow.fetch("concurrency").fetch("cancel-in-progress")
    steps = workflow.fetch("jobs").fetch("publish").fetch("steps")
    prepare = steps.index { |step| step["run"] == "ruby .github/scripts/release_image.rb prepare" }
    attest = steps.index { |step| step["uses"]&.start_with?("actions/attest-build-provenance@") }
    promote = steps.index { |step| step["run"] == "ruby .github/scripts/release_image.rb promote" }
    assert_operator prepare, :<, attest
    assert_operator attest, :<, promote
  end

  private

  def publisher(version)
    ReleaseImage.new(image: IMAGE, version: version, revision: REVISION, command: method(:docker))
  end

  def manifest(version, digest: ORIGINAL, revision: REVISION)
    { "digest" => digest, "annotations" => { "org.opencontainers.image.version" => version, "org.opencontainers.image.revision" => revision } }
  end

  # A registry double, not a network client. Commands must use separate arguments.
  def docker(*args)
    assert_equal [ "docker", "buildx", "imagetools" ], args.first(3)
    if args[3] == "inspect"
      tag = args[4].delete_prefix("#{IMAGE}:")
      return [ "", @errors[tag], Status.new(false) ] if @errors.key?(tag)
      value = @registry[tag]
      return [ "", "ERROR: #{args[4]}: not found\n", Status.new(false) ] unless value
      return [ JSON.generate(value), "", Status.new(true) ]
    end

    assert_equal "create", args[3]
    tag = args[args.index("--tag") + 1].delete_prefix("#{IMAGE}:")
    @writes << tag
    if args.last.start_with?("#{IMAGE}@") && args.count { |arg| arg.start_with?("#{IMAGE}@") } == 1
      @registry[tag] = @registry.values.find { |value| value["digest"] == args.last.delete_prefix("#{IMAGE}@") }.dup
    else
      notes = args.each_cons(2).filter_map { |flag, note| note.delete_prefix("index:").split("=", 2) if flag == "--annotation" }.to_h
      @registry[tag] = { "digest" => REBUILT, "annotations" => notes }
    end
    [ "", "", Status.new(true) ]
  end
end
