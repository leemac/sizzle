require "test_helper"
require "socket"
require "active_support/testing/constant_stubbing"

class PagePdfTest < ActiveSupport::TestCase
  include ActiveSupport::Testing::ConstantStubbing

  PAGE_URL = "https://samskitchen.example.com/chickpea-curry".freeze
  IMAGE_URL = "https://cdn.example.com/curry.png".freeze

  # Stands in for Ferrum::Network::InterceptedRequest.
  class FakeRequest
    attr_reader :url, :method, :resource_type, :answer

    def initialize(url, resource_type, method: "GET")
      @url = url
      @resource_type = resource_type
      @method = method
    end

    def respond(body:, responseHeaders: {}, responseCode: 200)
      @answer = responseCode == 200 ? [ :respond, body, responseHeaders ] : [ :respond, responseCode ]
    end
    def abort = @answer = [ :abort ]
    def handled? = !@answer.nil?
  end

  def resources(hosts = {}, html: "<h1>Curry</h1>")
    PagePdf::Resources.new(http: safe_http(hosts), html:, deadline: Process.clock_gettime(Process::CLOCK_MONOTONIC) + 30)
  end

  def answer(resources, url, type, **options)
    FakeRequest.new(url, type, **options).tap { |request| resources.answer(request) }.answer
  end

  test "serves the page from the HTML Sizzle already fetched, once" do
    pages = resources(html: "<h1>Curry</h1>")

    assert_equal [ :respond, "<h1>Curry</h1>", { "Content-Type" => "text/html; charset=utf-8" } ],
                 answer(pages, PAGE_URL, "Document")
    # A frame, meta refresh or any later navigation never reaches the network, and the page stays put.
    assert_equal [ :respond, 204 ], answer(pages, "https://evil.example/frame", "Document")
    assert_equal [ :respond, 204 ], answer(pages, PAGE_URL, "Document")
    assert_not_requested :any, /.*/
  end

  test "declares UTF-8 only for pages that are UTF-8" do
    latin1 = "<meta charset=windows-1252><p>Cr\xE8me br\xFBl\xE9e</p>".b

    assert_equal({ "Content-Type" => "text/html" }, answer(resources(html: latin1), PAGE_URL, "Document").last)
    assert_equal({ "Content-Type" => "text/html; charset=utf-8" }, answer(resources(html: "<p>Crème brûlée</p>"), PAGE_URL, "Document").last)
  end

  test "fetches stylesheets, images and fonts through SafeHttp with only a clean content type" do
    stub_request(:get, IMAGE_URL).to_return(body: "png", headers: { "Content-Type" => "image/png; x=1", "Set-Cookie" => "a=b" })
    stub_request(:get, "https://cdn.example.com/site.css").to_return(body: "h1{}", headers: { "Content-Type" => "text/css" })
    stub_request(:get, "https://cdn.example.com/font.woff2").to_return(body: "wOF2", headers: { "Content-Type" => "font/woff2 <script>" })
    pages = resources

    assert_equal [ :respond, "png", { "Content-Type" => "image/png" } ], answer(pages, IMAGE_URL, "Image")
    assert_equal [ :respond, "h1{}", { "Content-Type" => "text/css" } ], answer(pages, "https://cdn.example.com/site.css", "Stylesheet")
    assert_equal [ :respond, "wOF2", {} ], answer(pages, "https://cdn.example.com/font.woff2", "Font")
  end

  test "refuses scripts, media, posts, other schemes and anything SafeHttp blocks without fetching them" do
    pages = resources({ "router.example.com" => "192.168.1.1" })

    assert_equal [ :abort ], answer(pages, "https://cdn.example.com/app.js", "Script")
    assert_equal [ :abort ], answer(pages, "https://cdn.example.com/api", "XHR")
    assert_equal [ :abort ], answer(pages, "https://cdn.example.com/clip.mp4", "Media")
    assert_equal [ :abort ], answer(pages, IMAGE_URL, "Image", method: "POST")
    assert_equal [ :abort ], answer(pages, "file:///etc/passwd", "Image")
    assert_equal [ :abort ], answer(pages, "http://router.example.com/logo.png", "Image")
    assert_equal [ :abort ], answer(pages, "https://cdn.example.com:8443/logo.png", "Image")
    assert_not_requested :any, /.*/
  end

  test "a stylesheet that isn't CSS is refused" do
    stub_request(:get, "https://cdn.example.com/site.css").to_return(body: "<html>", headers: { "Content-Type" => "text/html" })

    assert_equal [ :abort ], answer(resources, "https://cdn.example.com/site.css", "Stylesheet")
  end

  test "caps how many files a page can make Sizzle fetch, and how much" do
    stub_request(:get, %r{\Ahttps://cdn\.example\.com/}).to_return(body: "x" * 10, headers: { "Content-Type" => "image/png" })

    stub_const(PagePdf::Resources, :MAX_RESOURCES, 2) do
      pages = resources
      2.times { |index| assert_equal :respond, answer(pages, "https://cdn.example.com/#{index}.png", "Image").first }
      assert_equal [ :abort ], answer(pages, "https://cdn.example.com/2.png", "Image")
    end

    stub_const(PagePdf::Resources, :MAX_TOTAL_BYTES, 15) do
      pages = resources
      assert_equal :respond, answer(pages, "https://cdn.example.com/a.png", "Image").first
      assert_equal [ :abort ], answer(pages, "https://cdn.example.com/b.png", "Image") # only 5 bytes of budget left
    end
  end

  test "attaches the PDF of the recipe's source page, fetched through SafeHttp" do
    stub_request(:get, PAGE_URL).to_return(body: "<h1>Curry</h1>", headers: { "Content-Type" => "text/html" })
    recipe = Recipe.create!(title: "Weeknight Chickpea Curry", source_url: PAGE_URL)
    pdf = PagePdf.new(http: safe_http)
    rendered = nil
    pdf.define_singleton_method(:render) do |html:, url:|
      rendered = [ html, url ]
      "%PDF-1.7 printed".b
    end

    pdf.attach(recipe)

    assert_equal [ "<h1>Curry</h1>", PAGE_URL ], rendered
    assert_equal "Weeknight Chickpea Curry.pdf", recipe.page_pdf.filename.to_s
    assert_equal "application/pdf", recipe.page_pdf.content_type
    assert_equal "%PDF-1.7 printed", recipe.page_pdf.download
  end

  test "a source that isn't a web page, or a private address, is never printed" do
    stub_request(:get, PAGE_URL).to_return(body: "%PDF-1.7", headers: { "Content-Type" => "application/pdf" })
    recipe = Recipe.create!(title: "Curry", source_url: PAGE_URL)

    assert_raises(SafeHttp::BadResponse) { PagePdf.new(http: safe_http).attach(recipe) }
    recipe.update!(source_url: "http://nas.example.com/recipe")
    assert_raises(SafeHttp::BlockedUrl) { PagePdf.new(http: safe_http("nas.example.com" => "10.0.0.5")).attach(recipe) }
    assert_not recipe.page_pdf.attached?
  end

  test "only real PDFs within the size cap are kept" do
    pdf = PagePdf.new

    assert_raises(PagePdf::Error) { pdf.send(:check!, "<html>".b) }
    stub_const(PagePdf, :MAX_PDF_BYTES, 10) { assert_raises(PagePdf::Error) { pdf.send(:check!, "%PDF-1.7 #{'x' * 10}".b) } }
    assert_equal "%PDF-1.7", pdf.send(:check!, "%PDF-1.7".b)
  end

  test "the browser prints the page without running scripts or reaching the network itself" do
    browser_path = ENV["SIZZLE_CHROMIUM_PATH"].presence
    skip "Chromium isn't installed" unless PagePdf.available?(browser_path:)

    listener = TCPServer.new("127.0.0.1", 0)
    port = listener.addr[1]
    connections = Queue.new
    accepting = Thread.new { loop { listener.accept.tap { |socket| connections << socket.peeraddr }.close } }
    stub_request(:get, "https://cdn.example.com/site.css").to_return(body: "h1{color:#c00}", headers: { "Content-Type" => "text/css" })
    stub_request(:get, "https://cdn.example.com/ran.png")
    html = <<~HTML
      <html><head>
        <link rel="preconnect" href="http://127.0.0.1:#{port}">
        <link rel="prefetch" href="http://127.0.0.1:#{port}/prefetch">
        <link rel="stylesheet" href="https://cdn.example.com/site.css">
        <meta http-equiv="refresh" content="0; url=http://127.0.0.1:#{port}/refresh">
      </head><body>
        <h1>Chickpea curry</h1>
        <a href="https://samskitchen.example.com/more">More curries</a>
        <a href="javascript:alert(document.domain)">Rate</a> <a href=" Java&#10;Script:alert(1)">Save</a>
        <a href="data:text/html,hi">Print</a> <map><area href="javascript:alert(2)"></map>
        <svg width="90" height="40"><a xlink:href="javascript:alert(3)"><rect width="90" height="40"/></a></svg>
        <img src="http://127.0.0.1:#{port}/logo.png">
        <iframe src="http://127.0.0.1:#{port}/frame"></iframe>
        <script>new Image().src = "https://cdn.example.com/ran.png"; fetch("http://127.0.0.1:#{port}/js")</script>
      </body></html>
    HTML

    pdf = PagePdf.new(http: safe_http, browser_path:, sandbox: false).render(html:, url: PAGE_URL)

    assert pdf.start_with?("%PDF-")
    # The PDF is served from Sizzle's origin, so only http(s) links survive printing.
    assert_equal [ "https://samskitchen.example.com/more" ], pdf.scan(%r{/URI\s*\(([^)]*)\)}).flatten
    assert_requested :get, "https://cdn.example.com/site.css"
    assert_not_requested :get, "https://cdn.example.com/ran.png"
    sleep 0.2
    assert connections.empty?, "the browser connected to a local address"
  ensure
    accepting&.kill
    listener&.close
  end
end
