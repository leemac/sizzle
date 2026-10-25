require "test_helper"

class SafeHttpTest < ActiveSupport::TestCase
  test "fetches a public URL" do
    stub_request(:get, "https://example.com/recipe").to_return(body: "<html>hi</html>", headers: { "Content-Type" => "text/html; charset=utf-8" })

    response = safe_http.get("https://example.com/recipe")

    assert_equal "<html>hi</html>", response.body
    assert_equal "text/html", response.content_type
  end

  test "blocks hosts that resolve to private, loopback, link-local or CGNAT addresses" do
    %w[127.0.0.1 10.1.2.3 172.16.0.5 192.168.2.79 169.254.169.254 100.100.1.1 0.0.0.0 ::1 fd00::1 fe80::1 ::ffff:127.0.0.1
       2002:7f00:1::1 2001:0:4136:e378:8000:63bf:3fff:fdd2 64:ff9b:1::a00:1 fec0::1].each do |ip|
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

  test "HTTP failures expose their status without including the response body" do
    [ 403, 404, 429, 503 ].each do |status|
      stub_request(:get, "https://example.com/recipe").to_return(status:, body: "upstream challenge markup")

      error = assert_raises(SafeHttp::HttpError) { safe_http.get("https://example.com/recipe") }

      assert_kind_of SafeHttp::BadResponse, error
      assert_equal status, error.status
      assert_equal "HTTP #{status}", error.message
      assert_not_includes error.message, "upstream challenge markup"
    end
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

  test "ignores proxy environment variables so the vetted IP stays pinned" do
    with_env("http_proxy" => "http://proxy.internal:3128", "HTTP_PROXY" => "http://proxy.internal:3128",
             "https_proxy" => "http://proxy.internal:3128", "HTTPS_PROXY" => "http://proxy.internal:3128") do
      %w[http://rebind.example/recipe https://rebind.example/recipe].each do |url|
        http = safe_http("rebind.example" => "93.184.215.14").send(:build_http, URI(url), "93.184.215.14")

        assert_not http.proxy?, "#{url} would go through a proxy, which re-resolves the hostname"
        assert_not http.proxy_from_env?
        assert_equal "93.184.215.14", http.ipaddr
      end

      stub_request(:get, "http://rebind.example/recipe").to_return(body: "ok")
      assert_equal "ok", safe_http("rebind.example" => "93.184.215.14").get("http://rebind.example/recipe").body
    end
  end

  test "an overall deadline stops a trickling response and closes the connection" do
    response = Net::HTTPOK.new("1.1", "200", "OK")
    chunks = 0
    response.define_singleton_method(:read_body) do |&block|
      loop do
        sleep 0.01
        chunks += 1
        block.call("x")
      end
    end
    connection = Object.new
    closed = false
    connection.define_singleton_method(:start) do |&block|
      block.call(self)
    ensure
      closed = true
    end
    connection.define_singleton_method(:request) { |_req, &block| block.call(response) }
    http = SafeHttp.new(resolver: FakeResolver.new, total_timeout: 0.1)
    http.define_singleton_method(:build_http) { |_uri, _ip| connection }

    assert_raises(SafeHttp::DeadlineExceeded) { http.get("https://example.com/") }
    assert_operator chunks, :>, 0
    assert closed
  end

  test "the deadline includes DNS and is shared across redirects" do
    calls = 0
    resolver = Object.new
    resolver.define_singleton_method(:getaddresses) do |_host|
      calls += 1
      sleep 0.06
      [ "93.184.215.14" ]
    end
    stub_request(:get, "https://example.com/a").to_return(status: 302, headers: { "Location" => "/b" })
    stub_request(:get, "https://example.com/b").to_return(body: "too late")

    http = SafeHttp.new(resolver:, total_timeout: 0.1)
    assert_raises(SafeHttp::DeadlineExceeded) { http.get("https://example.com/a") }
    assert_equal 2, calls
    assert_not_requested :get, "https://example.com/b"
  end

  test "an inherited deadline interrupts a fetch and cannot extend its own timeout" do
    resolver = Object.new
    resolver.define_singleton_method(:getaddresses) { |_host| sleep 1; [ "93.184.215.14" ] }
    http = SafeHttp.new(resolver:, total_timeout: 0.05)
    [ 0.02, 10 ].each do |remaining|
      started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      assert_raises(SafeHttp::DeadlineExceeded) do
        http.get("https://example.com/", deadline: started + remaining)
      end
      assert_operator Process.clock_gettime(Process::CLOCK_MONOTONIC) - started, :<, 0.5
    end
    assert_not_requested :get, "https://example.com/"
  end

  test "an exhausted inherited deadline does not resolve or fetch" do
    resolver = Object.new
    resolver.define_singleton_method(:getaddresses) { |_host| raise "must not resolve" }
    assert_raises(SafeHttp::DeadlineExceeded) do
      SafeHttp.new(resolver:).get("https://example.com/", deadline: 0)
    end
  end

  private

  def with_env(vars)
    saved = vars.keys.to_h { |key| [ key, ENV[key] ] }
    vars.each { |key, value| ENV[key] = value }
    yield
  ensure
    saved.each { |key, value| ENV[key] = value }
  end
end
