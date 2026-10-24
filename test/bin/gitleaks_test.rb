require "test_helper"
require "open3"
require "digest"

# bin/gitleaks downloads and runs an executable, so the checksum gate and the fallbacks are security
# boundaries. Each test runs a copy of the real script in a sandbox, with a stub curl in front of
# PATH that serves a fake release archive (or fails), so nothing touches the network.
class GitleaksInstallerTest < ActiveSupport::TestCase
  SCRIPT = Rails.root.join("bin/gitleaks")
  VERSION = SCRIPT.read[/^VERSION=(\S+)$/, 1]
  SYSTEM_PATH = "/usr/bin:/bin"

  setup do
    @root = Dir.mktmpdir("gitleaks-test")
    @repo = File.join(@root, "repo")
    @stubs = File.join(@root, "stubs")
    @ran_marker = File.join(@root, "fake-gitleaks-ran")
    FileUtils.mkdir_p([ File.join(@repo, "bin"), @stubs ])

    write_executable File.join(@stubs, "curl"), <<~SH
      #!/bin/sh
      echo "$*" >> "#{@root}/curl.log"
      # A wrapper that calls itself would never stop; end the sandbox's process group instead.
      [ "$(wc -l < "#{@root}/curl.log")" -lt 3 ] || kill -KILL 0
      [ -n "${FAKE_ARCHIVE:-}" ] || exit 22
      while [ $# -gt 0 ]; do
        [ "$1" = "-o" ] && out="$2"
        shift
      done
      cp "$FAKE_ARCHIVE" "$out"
    SH

    @archive = fake_release_archive
  end

  teardown { FileUtils.remove_entry(@root) }

  test "installs the release when the download matches the pinned checksum, then reuses it" do
    install_script(sha256: Digest::SHA256.file(@archive).hexdigest)

    output, status = run_gitleaks(archive: @archive)
    assert status.success?, output
    assert_includes output, "fake gitleaks #{VERSION}"
    assert File.executable?(installed_binary)
    assert_match %r{https://github\.com/gitleaks/gitleaks/releases/download/v#{Regexp.escape(VERSION)}/gitleaks_#{Regexp.escape(VERSION)}_(darwin|linux)_(arm64|x64)\.tar\.gz}, curl_log

    File.delete(File.join(@root, "curl.log"))
    output, status = run_gitleaks(archive: nil)
    assert status.success?, output
    assert_not File.exist?(File.join(@root, "curl.log")), "the cached binary should be reused without downloading"
  end

  test "rejects a download that doesn't match the pinned checksum without installing or running it" do
    install_script(sha256: "0" * 64)

    output, status = run_gitleaks(archive: @archive)
    assert_not status.success?
    assert_includes output, "doesn't match its pinned checksum"
    assert_not File.exist?(@ran_marker), "the unverified binary must never run"
    assert_empty Dir.glob(File.join(@repo, "tmp/bin/*")), "nothing from the unverified archive may be left behind"
  end

  test "fails clearly when the download fails and gitleaks isn't installed anywhere else" do
    install_script(sha256: Digest::SHA256.file(@archive).hexdigest)

    output, status = run_gitleaks(archive: nil)
    assert_not status.success?
    assert_includes output, "couldn't install gitleaks"
  end

  test "falls back to a gitleaks on PATH when the download fails" do
    install_script(sha256: Digest::SHA256.file(@archive).hexdigest)
    elsewhere = File.join(@root, "elsewhere")
    FileUtils.mkdir_p(elsewhere)
    write_executable File.join(elsewhere, "gitleaks"), "#!/bin/sh\necho \"system gitleaks $*\"\n"

    output, status = run_gitleaks(archive: nil, path: "#{elsewhere}:#{SYSTEM_PATH}")
    assert status.success?, output
    assert_includes output, "system gitleaks version"
  end

  test "the PATH fallback skips the wrapper itself when the repo's bin/ is on PATH" do
    install_script(sha256: Digest::SHA256.file(@archive).hexdigest)

    output, status = run_gitleaks(archive: nil, path: "#{File.join(@repo, "bin")}:#{SYSTEM_PATH}")
    assert_not status.success?
    assert_includes output, "couldn't install gitleaks"
    assert_equal 1, curl_log.lines.size, "the wrapper must not call itself"
  end

  private

  def write_executable(path, content)
    File.write(path, content)
    File.chmod(0o755, path)
  end

  # A release-shaped archive whose "gitleaks" leaves a marker, so tests can tell whether it ever ran.
  def fake_release_archive
    staging = File.join(@root, "release")
    FileUtils.mkdir_p(staging)
    write_executable File.join(staging, "gitleaks"), "#!/bin/sh\ntouch \"#{@ran_marker}\"\necho \"fake gitleaks #{VERSION}\"\n"
    archive = File.join(@root, "gitleaks.tar.gz")
    _, error, status = Open3.capture3("tar", "czf", archive, "-C", staging, "gitleaks")
    assert status.success?, error
    archive
  end

  # The real script with every pinned checksum replaced, so the fake archive can pass (or fail) the gate.
  def install_script(sha256:)
    write_executable File.join(@repo, "bin/gitleaks"), SCRIPT.read.gsub(/sha256=\h{64}/, "sha256=#{sha256}")
  end

  def run_gitleaks(archive:, path: SYSTEM_PATH)
    env = { "PATH" => "#{@stubs}:#{path}", "FAKE_ARCHIVE" => archive }
    Open3.capture2e(env, File.join(@repo, "bin/gitleaks"), "version", chdir: @root, pgroup: true)
  end

  def installed_binary = File.join(@repo, "tmp/bin/gitleaks-#{VERSION}")

  def curl_log = File.read(File.join(@root, "curl.log"))
end
