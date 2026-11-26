require "test_helper"
require "active_support/testing/constant_stubbing"

class PagePdfTest < ActiveSupport::TestCase
  include ActiveSupport::Testing::ConstantStubbing

  PAGE_URL = "https://samskitchen.example.com/chickpea-curry".freeze
  RENDERER_URL = "http://gotenberg:3000".freeze
  CONVERT_URL = "#{RENDERER_URL}/forms/chromium/convert/html".freeze
  PDF = "%PDF-1.7\n/Annots [<< /A << /S /URI /URI (https://samskitchen.example.com/more) >> >>]".b

  def page_pdf(renderer_url: RENDERER_URL)
    renderer = SafeHttp.new(resolver: FakeResolver.new("gotenberg" => "172.18.0.2"), allow_private: true)
    PagePdf.new(http: safe_http, renderer:, renderer_url:)
  end

  def stub_renderer(body = PDF, **options)
    stub_request(:post, CONVERT_URL).to_return(body:, headers: { "Content-Type" => "application/pdf" }, **options)
  end

  test "sends Gotenberg the bundled page and keeps the PDF it prints" do
    stub_request(:get, "https://samskitchen.example.com/curry.jpg").to_return(body: "JPG", headers: { "Content-Type" => "image/jpeg" })
    stub_renderer

    pdf = page_pdf.render(html: %(<h1>Curry</h1><img src="curry.jpg"><script>alert(1)</script>), url: PAGE_URL)

    assert_equal PDF, pdf
    assert_requested(:post, CONVERT_URL) do |request|
      body = request.body.b
      body.include?(%(filename="index.html")) && body.include?("<h1>Curry</h1>") && !body.include?("<script") &&
        body.include?(%(filename="asset-1.jpg"\r\nContent-Type: application/octet-stream\r\n\r\nJPG)) &&
        body.include?(%(name="emulatedMediaType"\r\n\r\nscreen))
    end
  end

  test "attaches the PDF of the recipe's source page, fetched through SafeHttp" do
    stub_request(:get, PAGE_URL).to_return(body: "<h1>Curry</h1>", headers: { "Content-Type" => "text/html" })
    stub_renderer
    recipe = Recipe.create!(title: "Weeknight Chickpea Curry", source_url: PAGE_URL)

    page_pdf.attach(recipe)

    assert_equal "Weeknight Chickpea Curry.pdf", recipe.page_pdf.filename.to_s
    assert_equal "application/pdf", recipe.page_pdf.content_type
    assert_equal PDF, recipe.page_pdf.download
  end

  test "a source that isn't a web page, or a private address, is never sent to the renderer" do
    stub_request(:get, PAGE_URL).to_return(body: "%PDF-1.7", headers: { "Content-Type" => "application/pdf" })
    recipe = Recipe.create!(title: "Curry", source_url: PAGE_URL)

    assert_raises(SafeHttp::BadResponse) { page_pdf.attach(recipe) }
    recipe.update!(source_url: "http://nas.example.com/recipe")
    pdf = PagePdf.new(http: safe_http("nas.example.com" => "10.0.0.5"), renderer_url: RENDERER_URL)
    assert_raises(SafeHttp::BlockedUrl) { pdf.attach(recipe) }
    assert_not_requested :post, CONVERT_URL
    assert_not recipe.page_pdf.attached?
  end

  test "only real PDFs within the size cap, with http(s) links and no scripts or actions, are kept" do
    {
      "<html>not a pdf" => "didn't return a PDF",
      "%PDF-1.7 /URI (javascript:alert\\(1\\))" => "isn't http(s)",
      "%PDF-1.7 /URI <6a6176617363726970743a>" => "isn't http(s)",
      "%PDF-1.7 /S /JavaScript /JS (app.alert(1))" => "script or action",
      "%PDF-1.7 /S /Launch /F (calc.exe)" => "script or action"
    }.each do |body, message|
      stub_renderer(body)
      error = assert_raises(PagePdf::Error) { page_pdf.render(html: "<h1>Curry</h1>", url: PAGE_URL) }
      assert_includes error.message, message
    end

    stub_renderer("%PDF-1.7 #{'x' * 20}")
    stub_const(PagePdf, :MAX_PDF_BYTES, 10) do
      assert_raises(PagePdf::Error) { page_pdf.render(html: "<h1>Curry</h1>", url: PAGE_URL) }
    end
  end

  test "a renderer that fails or redirects is reported as a PDF error" do
    stub_renderer("Internal error", status: 500)
    assert_raises(PagePdf::Error) { page_pdf.render(html: "<h1>Curry</h1>", url: PAGE_URL) }

    stub_renderer("", status: 302, headers: { "Location" => "https://evil.example/" })
    assert_raises(PagePdf::Error) { page_pdf.render(html: "<h1>Curry</h1>", url: PAGE_URL) }
    assert_not_requested :get, "https://evil.example/"
  end

  # Runs against a real Gotenberg started with docker-compose.yml's flags, when SIZZLE_TEST_GOTENBERG_URL
  # points at one; skipped otherwise (CI has no renderer).
  test "Gotenberg prints a hostile page with only its http(s) links" do
    renderer_url = ENV["SIZZLE_TEST_GOTENBERG_URL"].presence or skip "set SIZZLE_TEST_GOTENBERG_URL to run against Gotenberg"
    WebMock.disable_net_connect!(allow: URI(renderer_url).host)
    stub_request(:get, "https://cdn.example.com/site.css").to_return(body: "h1{color:#c00}", headers: { "Content-Type" => "text/css" })
    html = <<~HTML
      <link rel="stylesheet" href="https://cdn.example.com/site.css"><meta http-equiv="refresh" content="0; url=https://evil.example/">
      <h1>Chickpea curry</h1><a href="/more">More curries</a> <a href="javascript:alert(1)">Rate</a>
      <svg width="40" height="20"><a xlink:href="javascript:alert(2)"><rect width="40" height="20"/></a></svg>
      <iframe src="file:///etc/passwd"></iframe><img src="file:///etc/passwd">
    HTML
    renderer = SafeHttp.new(allow_private: true, read_timeout: 60, total_timeout: 60)

    pdf = PagePdf.new(http: safe_http, renderer:, renderer_url:).render(html:, url: PAGE_URL)

    assert pdf.start_with?("%PDF-")
    assert_equal [ "https://samskitchen.example.com/more" ], pdf.scan(%r{/URI\s*\(([^)]*)\)}).flatten
  ensure
    WebMock.disable_net_connect!
  end
end
