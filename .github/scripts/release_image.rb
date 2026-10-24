require "json"
require "open3"

# Release jobs share a repository-wide concurrency group. Keep the registry checks
# and writes inside that lock: Docker tags do not offer compare-and-swap.
class ReleaseImage
  NUMBER = "(?:0|[1-9][0-9]*)"
  STABLE = /\A#{NUMBER}\.#{NUMBER}\.#{NUMBER}\z/
  VERSION = /\A#{NUMBER}\.#{NUMBER}\.#{NUMBER}(?:-(?:#{NUMBER}|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:#{NUMBER}|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*)?\z/
  DIGEST = /\Asha256:[0-9a-f]{64}\z/

  def initialize(image:, version:, revision:, command: Open3.method(:capture3))
    raise ArgumentError, "Invalid release version" unless VERSION.match?(version)
    raise ArgumentError, "Invalid image name" unless /\Aghcr\.io\/[a-z0-9._-]+\/[a-z0-9._-]+\z/.match?(image)
    raise ArgumentError, "Invalid commit" unless /\A[0-9a-f]{40}\z/.match?(revision)

    @image, @version, @revision, @command = image, version, revision, command
  end

  def prepare(digests:, annotations:)
    if (existing = inspect_tag(@version))
      return release_digest(existing)
    end

    raise ArgumentError, "Expected two platform digests" unless digests.length == 2 && digests.uniq.length == 2 && digests.all? { |digest| DIGEST.match?(digest) }
    # Identity is written explicitly, rather than trusting metadata-action defaults.
    identity = [ "index:org.opencontainers.image.version=#{@version}", "index:org.opencontainers.image.revision=#{@revision}" ]
    notes = annotations.reject { |note| note.match?(/org\.opencontainers\.image\.(version|revision)=/) }
    args = (notes + identity).flat_map { |note| [ "--annotation", note ] }
    docker("create", *args, "--tag", reference(@version), *digests.map { |digest| "#{@image}@#{digest}" })
    release_digest(inspect_tag(@version) || raise("Published image is missing"))
  end

  # Called only after provenance has been attested for this exact digest.
  def promote(digest:)
    raise ArgumentError, "Invalid digest" unless DIGEST.match?(digest)
    raise "Release digest changed" unless release_digest(inspect_tag(@version) || raise("Release is missing")) == digest
    return false unless STABLE.match?(@version)

    parts = @version.split(".")
    tags = [ "latest", parts.first(2).join(".") ]
    tags << parts.first unless parts.first == "0"
    # Validate all targets before writing any of them. Unknown metadata fails closed.
    eligible = tags.select do |tag|
      current = inspect_tag(tag)
      next true unless current

      current_version = current.fetch("annotations", {})["org.opencontainers.image.version"]
      raise "Invalid version metadata on #{tag}" unless current_version.is_a?(String) && STABLE.match?(current_version)
      comparison = @version.split(".").map(&:to_i) <=> current_version.split(".").map(&:to_i)
      raise "Conflicting digest on #{tag}" if comparison.zero? && current.fetch("digest") != digest
      comparison >= 0
    end
    eligible.each do |tag|
      docker("create", "--tag", reference(tag), "#{@image}@#{digest}")
    end
    eligible.include?("latest")
  end

  private

  def reference(tag)
    "#{@image}:#{tag}"
  end

  def release_digest(manifest)
    annotations = manifest.fetch("annotations", {})
    unless annotations["org.opencontainers.image.version"] == @version && annotations["org.opencontainers.image.revision"] == @revision
      raise "Existing release belongs to another version or commit; cut a new version"
    end
    manifest.fetch("digest")
  end

  def inspect_tag(tag)
    ref = reference(tag)
    stdout, stderr, status = @command.call("docker", "buildx", "imagetools", "inspect", ref, "--format", "{{json .Manifest}}")
    # Only the CLI's explicit missing-manifest response permits creation. Auth,
    # timeouts, and other registry failures must never authorize overwriting a tag.
    return nil if !status.success? && stderr.strip == "ERROR: #{ref}: not found"
    raise "Cannot inspect #{ref}: #{stderr}" unless status.success?

    manifest = JSON.parse(stdout)
    raise "Invalid manifest digest on #{tag}" unless DIGEST.match?(manifest.fetch("digest"))
    manifest
  end

  def docker(*args)
    stdout, stderr, status = @command.call("docker", "buildx", "imagetools", *args)
    raise "Image publication failed: #{stderr}" unless status.success?
    stdout
  end
end

if $PROGRAM_NAME == __FILE__
  publisher = ReleaseImage.new(image: ENV.fetch("IMAGE"), version: ENV.fetch("VERSION"), revision: ENV.fetch("GITHUB_SHA"))
  result = case ARGV.fetch(0)
  when "prepare"
    digests = Dir.children(ENV.fetch("DIGESTS_PATH")).map { |name| "sha256:#{name}" }
    annotations = JSON.parse(ENV.fetch("DOCKER_METADATA_OUTPUT_JSON")).fetch("annotations")
    "digest=#{publisher.prepare(digests: digests, annotations: annotations)}"
  when "promote"
    "latest=#{publisher.promote(digest: ENV.fetch('DIGEST'))}"
  else
    abort "Expected prepare or promote"
  end
  File.open(ENV.fetch("GITHUB_OUTPUT"), "a") { |file| file.puts(result) }
end
