require "test_helper"

# Gotenberg's isolation lives in docker-compose.yml, so a one-line edit could undo it. These tests make
# that edit fail CI. See SECURITY.md, "Optional page PDFs".
class PagePdfRendererConfigTest < ActiveSupport::TestCase
  setup do
    @compose = YAML.safe_load_file(Rails.root.join("docker-compose.yml"))
    @renderer = @compose.fetch("services").fetch("gotenberg")
  end

  test "Gotenberg only starts when asked for, from a pinned image" do
    assert_equal [ "page-pdfs" ], @renderer["profiles"]
    assert_match(/\Adocker\.io\/gotenberg\/gotenberg:[\d.]+-chromium@sha256:\h{64}\z/, @renderer["image"])
  end

  test "Gotenberg is on an internal network only, with no published ports" do
    assert_equal [ "pdf-renderer" ], @renderer["networks"]
    assert_equal true, @compose.dig("networks", "pdf-renderer", "internal")
    assert_nil @renderer["ports"]
    assert_nil @renderer["network_mode"]
    assert_includes @compose.dig("services", "sizzle", "networks"), "pdf-renderer"
  end

  test "Gotenberg's Chromium runs without JavaScript or network, and its fetching features are off" do
    flags = @renderer.fetch("command")

    %w[--chromium-disable-javascript --chromium-allow-list=^file:///tmp/ --chromium-deny-private-ips
       --chromium-deny-public-ips --api-disable-download-from --webhook-disable].each do |flag|
      assert_includes flags, flag
    end
    assert_includes flags, "--chromium-host-resolver-rules=MAP * ~NOTFOUND"
    assert_not flags.any? { |flag| flag.match?(/ignore-certificate|enable-environment-proxy|proxy-server|shared-browser-context/) }
  end

  test "Gotenberg's container is read-only and can't gain privileges" do
    assert_equal true, @renderer["read_only"]
    assert_includes @renderer["security_opt"], "no-new-privileges:true"
  end
end
