require "test_helper"

class SafeHttpTest < ActiveSupport::TestCase
  test "fetches a public URL" do
    stub_request(:get, "https://example.com/recipe").to_return(body: "<html>hi</html>", headers: { "Content-Type" => "text/html; charset=utf-8" })

    response = safe_http.get("https://example.com/recipe")

    assert_equal "<html>hi</html>", response.body
    assert_equal "text/html", response.content_type
  end

  test "blocks hosts that resolve to private, loopback, link-local or CGNAT addresses" do
    %w[127.0.0.1 10.1.2.3 172.16.0.5 192.168.2.79 169.254.169.254 100.100.1.1 0.0.0.0 ::1 fd00::1 fe80::1 ::ffff:127.0.0.1].each do |ip|
      error = assert_raises(SafeHttp::BlockedUrl, "expected #{ip} to be blocked") do
        safe_http("internal.example" => ip).get("http://internal.example/")
      end
      assert_match "non-public", error.message
    end
  end

  test "blocks a host if any of its addresses is private" do
    assert_raises(SafeHttp::BlockedUrl) do
      safe_http("mixed.example" => [ "93.184.215.14", "10.0.0.1" ]).get("https://mixed.example/")
    end
  end

  test "rejects non-http schemes, credentials and unusual ports" do
    http = safe_http
    [ "file:///etc/passwd", "ftp://example.com/x", "gopher://example.com", "https://user:pass@example.com/",
      "http://example.com:6379/", "not a url" ].each do |url|
      assert_raises(SafeHttp::BlockedUrl, "expected #{url} to be rejected") { http.get(url) }
    end
  end

  test "re-validates every redirect hop" do
    stub_request(:get, "https://example.com/go").to_return(status: 302, headers: { "Location" => "http://metadata.internal/latest" })

    assert_raises(SafeHttp::BlockedUrl) do
      safe_http("metadata.internal" => "169.254.169.254").get("https://example.com/go")
    end
  end

  test "follows safe redirects up to a limit" do
    stub_request(:get, "https://example.com/a").to_return(status: 301, headers: { "Location" => "/b" })
    stub_request(:get, "https://example.com/b").to_return(body: "ok", headers: { "Content-Type" => "text/plain" })
    assert_equal "ok", safe_http.get("https://example.com/a").body

    stub_request(:get, "https://example.com/loop").to_return(status: 302, headers: { "Location" => "/loop" })
    assert_raises(SafeHttp::BadResponse) { safe_http.get("https://example.com/loop") }
  end

  test "enforces the body size cap" do
    stub_request(:get, "https://example.com/huge").to_return(body: "x" * 2_000)

    assert_raises(SafeHttp::TooLarge) { safe_http.get("https://example.com/huge", max_bytes: 1_000) }
  end

  test "filters by content type" do
    stub_request(:get, "https://example.com/not-an-image").to_return(body: "<html>", headers: { "Content-Type" => "text/html" })

    assert_raises(SafeHttp::BadResponse) { safe_http.get("https://example.com/not-an-image", accept: "image/") }
  end

  test "private addresses are allowed when explicitly enabled" do
    stub_request(:get, "http://nas.local/recipe").to_return(body: "ok")
    http = SafeHttp.new(resolver: FakeResolver.new("nas.local" => "192.168.2.11"), allow_private: true)

    assert_equal "ok", http.get("http://nas.local/recipe").body
  end
end
