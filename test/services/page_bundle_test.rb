require "test_helper"
require "active_support/testing/constant_stubbing"

class PageBundleTest < ActiveSupport::TestCase
  include ActiveSupport::Testing::ConstantStubbing

  PAGE_URL = "https://samskitchen.example.com/recipes/curry".freeze

  def build(html, hosts = {})
    PageBundle.new(http: safe_http(hosts)).build(html, url: PAGE_URL)
  end

  def doc(bundle)
    Nokogiri::HTML5(bundle.html)
  end

  def stub_file(url, body, type)
    stub_request(:get, url).to_return(body:, headers: { "Content-Type" => type })
  end

  # Every attribute value in the bundle that could load or link to something.
  def references(bundle)
    doc(bundle).xpath("//@*").select { |attribute| PageBundle::URL_ATTRIBUTES.include?(attribute.name.downcase) }.map(&:value)
  end

  test "copies stylesheets, imports, fonts and images into the bundle and points the page at the copies" do
    stub_file("https://cdn.example.com/site.css", %(@import "fonts.css" print; h1{background:url(img/bg.png)}), "text/css")
    stub_file("https://cdn.example.com/fonts.css", %(@font-face{font-family:Brand;src:url("/f/brand.woff2")}), "text/css")
    stub_file("https://cdn.example.com/f/brand.woff2", "wOF2", "font/woff2")
    stub_file("https://cdn.example.com/img/bg.png", "PNG", "image/png")
    stub_file("https://samskitchen.example.com/media/curry.jpg", "JPG", "image/jpeg")

    bundle = build(<<~HTML)
      <link rel="stylesheet" href="https://cdn.example.com/site.css" media="screen">
      <h1>Curry</h1><img src="/media/curry.jpg" alt="Curry"><img src="/media/curry.jpg">
    HTML

    assert_equal({ "asset-1.png" => "PNG", "asset-2.woff2" => "wOF2", "asset-3.jpg" => "JPG" }, bundle.files)
    style = doc(bundle).at_css("style")
    assert_equal "screen", style["media"]
    assert_includes style.text, %(@media print {@font-face{font-family:Brand;src:url("asset-2.woff2")}})
    assert_includes style.text, %(h1{background:url("asset-1.png")})
    assert_equal %w[asset-3.jpg asset-3.jpg], doc(bundle).css("img").map { |img| img["src"] }
    assert_requested :get, "https://samskitchen.example.com/media/curry.jpg", times: 1
  end

  test "uses the real image behind a lazy-loading placeholder" do
    stub_file("https://samskitchen.example.com/media/curry-1200.jpg", "JPG", "image/jpeg")

    bundle = build(%(<img src="data:image/gif;base64,R0lGOD" data-src="/media/curry-1200.jpg" loading="lazy" srcset="a.jpg 2x">))

    img = doc(bundle).at_css("img")
    assert_equal "asset-1.jpg", img["src"]
    assert_nil img["data-src"]
    assert_nil img["srcset"]
    assert_nil img["loading"]
  end

  test "the bundle refers to nothing but its own files, fragments, inline images and http(s) links" do
    bundle = build(<<~HTML, { "nas.example.com" => "192.168.1.10" })
      <base href="https://samskitchen.example.com/">
      <meta http-equiv="refresh" content="0; url=https://evil.example/">
      <link rel="preconnect" href="http://nas.example.com"><link rel="icon" href="/favicon.ico">
      <script src="https://evil.example/x.js"></script><noscript><img src="http://nas.example.com/pixel.gif"></noscript>
      <iframe src="https://evil.example/"></iframe><object data="https://evil.example/x.swf"></object><embed src="x.swf">
      <video poster="https://evil.example/p.jpg" src="v.mp4"></video><audio src="a.mp3"></audio>
      <form action="https://evil.example/post"><button formaction="https://evil.example/b">Go</button><input type="image" src="i.png"></form>
      <img src="file:///etc/passwd"><img src="data:image/png;base64,iVBOR" alt="inline">
      <table background="https://evil.example/bg.png"><tr><td>x</td></tr></table>
      <a href="recipes/more" ping="https://evil.example/ping">More</a> <a href="#method">Method</a>
      <a href="javascript:alert(1)" onclick="alert(2)">Rate</a> <a href=" Java&#10;Script:alert(3)">Save</a>
      <a href="data:text/html,hi">Print</a> <a href="file:///etc/passwd">Local</a>
      <map name="m"><area href="javascript:alert(4)"></map><img usemap="#m" src="data:image/gif;base64,R0">
      <svg><a xlink:href="javascript:alert(5)"><text>svg</text></a><image href="https://evil.example/i.png"/>
        <use href="#shape"/><script>alert(6)</script><set attributeName="href" to="javascript:alert(7)"/>
        <animate attributeName="href" values="javascript:alert(8)"/></svg>
    HTML
    page = doc(bundle)

    assert_empty bundle.files
    assert_empty page.xpath("//*[local-name()='script' or local-name()='iframe' or local-name()='object' or local-name()='embed' or local-name()='video' or local-name()='audio' or local-name()='link' or local-name()='base' or local-name()='set' or local-name()='animate']")
    assert_equal [ "utf-8" ], page.css("meta").map { |meta| meta["charset"] }
    assert_empty page.xpath("//@*[starts-with(local-name(), 'on')]")
    assert_equal [ "data:image/png;base64,iVBOR", "https://samskitchen.example.com/recipes/more", "#method", "#m",
                   "data:image/gif;base64,R0", "#shape" ], references(bundle)
    # Nothing on a private address was fetched, even inside <noscript>.
    assert_not_requested :any, /nas\.example\.com/
  end

  test "stylesheet text can't end its <style> element or reach anything outside the bundle" do
    stub_file("https://cdn.example.com/site.css",
              %(h1{color:red}</style><a href="javascript:alert(1)">x</a><style>p{background:url(http://nas.example.com/x.png)}),
              "text/css")

    bundle = build(%(<link rel="stylesheet" href="https://cdn.example.com/site.css">), { "nas.example.com" => "10.0.0.5" })
    page = doc(bundle)

    assert_equal 1, page.css("style").size
    assert_empty page.css("a")
    assert_includes page.at_css("style").text, %(<\\/style>)
    assert_includes page.at_css("style").text, %(url("data:,"))
    assert_not_requested :any, /nas\.example\.com/
  end

  test "inline styles and style elements are rewritten too, without following imports from style attributes" do
    stub_file("https://samskitchen.example.com/hero.png", "PNG", "image/png")
    stub_request(:get, "https://cdn.example.com/a.css").to_return(status: 404)
    stub_request(:get, "https://evil.example/t.png").to_return(status: 404)

    bundle = build(<<~HTML)
      <style>@import url("https://cdn.example.com/a.css"); .hero{background:url('/hero.png')} .x{mask:url(#m)}</style>
      <div style="background-image:url(/hero.png)">hero</div><p style="background:url(https://evil.example/t.png)">x</p>
    HTML

    assert_requested :get, "https://cdn.example.com/a.css"
    assert_equal({ "asset-1.png" => "PNG" }, bundle.files)
    assert_includes doc(bundle).at_css("style").text, %(.hero{background:url("asset-1.png")} .x{mask:url("#m")})
    assert_equal [ 'background-image:url("asset-1.png")', 'background:url("data:,")' ], doc(bundle).css("[style]").map { |node| node["style"] }
  end

  test "alternate and disabled stylesheets aren't applied" do
    bundle = build(<<~HTML)
      <link rel="alternate stylesheet" href="https://cdn.example.com/dark.css">
      <link rel="stylesheet" href="https://cdn.example.com/old.css" disabled>
    HTML

    assert_empty doc(bundle).css("style")
    assert_not_requested :any, /cdn\.example\.com/
  end

  test "imports nest at most two levels below a page's stylesheet" do
    stub_file("https://cdn.example.com/1.css", %(@import "2.css"; .one{}), "text/css")
    stub_file("https://cdn.example.com/2.css", %(@import "3.css"; .two{}), "text/css")
    stub_file("https://cdn.example.com/3.css", %(@import "4.css"; .three{}), "text/css")

    bundle = build(%(<link rel="stylesheet" href="https://cdn.example.com/1.css">))

    assert_includes doc(bundle).at_css("style").text, ".three{}"
    assert_not_requested :get, "https://cdn.example.com/4.css"
  end

  test "caps how many files a page can make Sizzle fetch, and how much" do
    stub_request(:get, %r{\Ahttps://cdn\.example\.com/}).to_return(body: "x" * 10, headers: { "Content-Type" => "image/png" })
    images = (1..4).map { |n| %(<img src="https://cdn.example.com/#{n}.png">) }.join

    stub_const(PageBundle, :MAX_FILES, 2) { assert_equal 2, build(images).files.size }
    stub_const(PageBundle, :MAX_TOTAL_BYTES, 25) { assert_equal 2, build(images).files.size }
  end

  test "a page that isn't UTF-8 is read in its own encoding and written out as UTF-8" do
    bundle = build("<meta charset=windows-1252><p>Cr\xE8me br\xFBl\xE9e</p>".b)

    assert_includes bundle.html, "Crème brûlée"
    assert_equal [ "utf-8" ], doc(bundle).css("meta").map { |meta| meta["charset"] }
  end
end
