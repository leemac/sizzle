require "test_helper"

class YoutubeVideoTest < ActiveSupport::TestCase
  ID = YoutubeWatchPage::VIDEO_ID
  WATCH_URL = "https://www.youtube.com/watch?v=#{ID}".freeze
  RECIPE_URL = "https://samskitchen.example.com/chickpea-curry".freeze

  def stub_watch_page(**options)
    stub_request(:get, WATCH_URL).to_return(body: YoutubeWatchPage.html(**options), headers: { "Content-Type" => "text/html" })
  end

  def fetch(http: safe_http)
    YoutubeVideo.fetch(ID, http:)
  end

  test "recognises YouTube video links and keeps only the video id" do
    [
      "https://www.youtube.com/watch?v=#{ID}", "https://youtube.com/watch?v=#{ID}&t=42s&si=abc",
      "https://m.youtube.com/watch?feature=share&v=#{ID}", "http://youtu.be/#{ID}", "https://youtu.be/#{ID}?si=x",
      "https://www.youtube.com/shorts/#{ID}", "https://www.youtube.com/live/#{ID}?feature=share",
      "https://www.youtube.com/embed/#{ID}", "  HTTPS://WWW.YOUTUBE.COM/watch?v=#{ID}  "
    ].each { |url| assert_equal ID, YoutubeVideo.id_from_url(url), url }
  end

  test "ignores links that aren't a single YouTube video" do
    [
      "https://youtube.com.evil.example/watch?v=#{ID}", "https://evil.example/watch?v=#{ID}",
      "https://notyoutube.com/watch?v=#{ID}", "https://www.youtube.com/watch?v=short",
      "https://www.youtube.com/watch?v=#{ID}x", "https://www.youtube.com/watch?v=../../etc%2F",
      "https://www.youtube.com/@emmasgoodies", "https://www.youtube.com/playlist?list=PL123",
      "https://youtu.be/", "https://youtu.be/#{ID}/extra", "javascript:alert(1)//youtu.be/#{ID}",
      "ftp://youtu.be/#{ID}", "not a url", nil
    ].each { |url| assert_nil YoutubeVideo.id_from_url(url), url.inspect }
  end

  test "only builds watch URLs from valid ids" do
    assert_equal WATCH_URL, YoutubeVideo.watch_url(ID)
    assert_raises(ArgumentError) { YoutubeVideo.watch_url("x?v=1&evil") }
  end

  test "reads the title, channel and full description from the watch page" do
    stub_watch_page
    page = fetch

    assert_equal WATCH_URL, page.canonical_url
    assert_equal "No-Knead Focaccia", page.title
    assert_equal "Emma's Goodies", page.site_name
    assert_includes page.text, "- 560g bread flour"
    assert_includes page.text, "Video description:"
    assert_nil page.structured_recipe
  end

  test "asks for the desktop page and skips the EU consent screen" do
    stub_watch_page
    fetch

    assert_requested :get, WATCH_URL, headers: { "User-Agent" => YoutubeVideo::USER_AGENT, "Cookie" => "SOCS=CAI" }
  end

  test "reads video duration and creator-written timestamps without treating them as cooking times" do
    stub_watch_page(details: { "lengthSeconds" => "4000" },
                    description: "Chapters:\n0:00 Intro\n- 01:25 - Make the dough\n1:02:03 Bake\n1:99 Bad timestamp\n")
    video = fetch.video_metadata

    assert_equal ID, video["id"]
    assert_equal 4000, video["duration_seconds"]
    assert_equal [
      { "start_seconds" => 0, "title" => "Intro" },
      { "start_seconds" => 85, "title" => "Make the dough" },
      { "start_seconds" => 3723, "title" => "Bake" }
    ], video["chapters"]
  end

  test "missing or malformed duration does not prevent importing the video" do
    [ nil, 300, {}, "1.5", "-30", "9" * 1000 ].each do |value|
      stub_watch_page(details: { "lengthSeconds" => value })

      assert_nil fetch.video_metadata["duration_seconds"], value.inspect
    end
  end

  test "finds the end of the player data even when the description contains braces, quotes and script" do
    description = %(Sauce: {"a": 1} "quoted" \\ back\\slash };var x = {"y": "}"};</script><b>bold</b>)
    stub_watch_page(description:)

    assert_includes fetch.text, description
  end

  test "clamps uploader-written fields before they are stored" do
    stub_watch_page(title: "T" * 5_000, author: "#{'A' * 5_000}\n\nnewline", description: "D" * 50_000)
    page = fetch

    assert_operator page.title.length, :<=, 300
    assert_operator page.site_name.length, :<=, PageScraper::MAX_SITE_NAME_CHARS
    assert_operator page.text.length, :<=, YoutubeVideo::MAX_DESCRIPTION_CHARS + 400
  end

  test "drops bidi overrides and zero-width characters from the channel name" do
    stub_watch_page(author: "Emma‮'s​ Goodies")

    assert_equal "Emma's Goodies", fetch.site_name
  end

  test "deeply nested player data fails clearly instead of raising" do
    nested = "#{'{"a":' * 500}1#{'}' * 500}"
    stub_request(:get, WATCH_URL).to_return(body: "<script>var ytInitialPlayerResponse = #{nested};</script>",
                                            headers: { "Content-Type" => "text/html" })

    assert_raises(YoutubeVideo::Unavailable) { fetch }
  end

  test "thumbnails come from the video id, never from the page" do
    stub_watch_page(details: { "thumbnail" => { "thumbnails" => [ { "url" => "http://169.254.169.254/latest" } ] } })
    urls = fetch.images.map(&:url)

    assert_equal [ "https://i.ytimg.com/vi/#{ID}/maxresdefault.jpg", "https://i.ytimg.com/vi/#{ID}/sddefault.jpg" ], urls
  end

  test "rejects a page whose player data is for a different video" do
    stub_watch_page(video_id: "AAAAAAAAAAA")

    error = assert_raises(YoutubeVideo::Unavailable) { fetch }
    assert_includes error.message, "isn't available"
  end

  test "explains when YouTube wants the server to sign in" do
    stub_watch_page(status: "LOGIN_REQUIRED", details: nil)

    error = assert_raises(YoutubeVideo::Unavailable) { fetch }
    assert_includes error.message, "sign in"
  end

  test "fails clearly when the page has no player data" do
    stub_request(:get, WATCH_URL).to_return(body: "<html><body>Before you continue to YouTube</body></html>",
                                            headers: { "Content-Type" => "text/html" })

    error = assert_raises(YoutubeVideo::Unavailable) { fetch }
    assert_includes error.message, "Couldn't read"
  end

  test "fails clearly when the player data is cut off" do
    stub_request(:get, WATCH_URL).to_return(body: '<script>var ytInitialPlayerResponse = {"videoDetails": {"title": "Fo',
                                            headers: { "Content-Type" => "text/html" })

    assert_raises(YoutubeVideo::Unavailable) { fetch }
  end

  test "follows a recipe link in the description and brings its structured data and photos" do
    stub_watch_page(description: "Easy curry!\n\nCookbook: https://shop.example.com/book\nFull recipe: #{RECIPE_URL}")
    stub_request(:get, RECIPE_URL).to_return(body: file_fixture_html("recipe_page.html"), headers: { "Content-Type" => "text/html" })
    page = fetch

    assert_equal WATCH_URL, page.canonical_url, "the video stays the source"
    assert_equal "Weeknight Chickpea Curry", page.structured_recipe["name"]
    assert_includes page.text, "Linked recipe page (#{RECIPE_URL})"
    assert_equal RECIPE_URL, page.video_metadata["written_recipe_url"]
    assert_equal "https://cdn.example.com/curry-1200x900.jpg", page.images.first.url
    assert_equal "https://i.ytimg.com/vi/#{ID}/maxresdefault.jpg", page.images[-2].url
    assert_not_requested :get, "https://shop.example.com/book"
  end

  test "thumbnails keep their slots when the linked page fills the candidate list" do
    photos = (1..30).map { |n| %(<img src="https://cdn.example.com/photo-#{n}.jpg" width="800" height="600">) }.join
    stub_watch_page(description: "Recipe: #{RECIPE_URL}")
    stub_request(:get, RECIPE_URL).to_return(body: "<main>#{photos}</main>", headers: { "Content-Type" => "text/html" })
    urls = fetch.images.map(&:url)

    assert_equal PageScraper::MAX_IMAGES, urls.size
    assert_equal [ "https://i.ytimg.com/vi/#{ID}/maxresdefault.jpg", "https://i.ytimg.com/vi/#{ID}/sddefault.jpg" ], urls.last(2)
    assert_equal urls.uniq, urls
  end

  test "follows a link right under a recipe label" do
    stub_watch_page(description: "RECIPE 👇\n#{RECIPE_URL}")
    stub_request(:get, RECIPE_URL).to_return(body: file_fixture_html("recipe_page.html"), headers: { "Content-Type" => "text/html" })

    assert fetch.structured_recipe
  end

  test "doesn't treat a title that mentions recipe as a label for the next link" do
    stub_watch_page(description: "No Knead Focaccia Recipe\n\nPre-order my cookbook: https://shop.example.com/book")

    assert_nil fetch.structured_recipe
    assert_not_requested :get, "https://shop.example.com/book"
  end

  test "skips social, video and shop links even on a recipe line" do
    stub_watch_page(description: "More recipes: https://youtu.be/AAAAAAAAAAA https://www.instagram.com/emma " \
                                 "https://amzn.to/3abc https://m.youtube.com/@emma")

    assert_nil fetch.structured_recipe
    assert_requested :get, WATCH_URL, times: 1
    %w[https://youtu.be/AAAAAAAAAAA https://www.instagram.com/emma https://amzn.to/3abc].each do |url|
      assert_not_requested :get, url
    end
  end

  test "recipe links go through SafeHttp, so private addresses are never fetched" do
    stub_watch_page(description: "Recipe: http://recipes.internal.example/curry")
    page = fetch(http: safe_http("recipes.internal.example" => "10.0.0.5"))

    assert_includes page.text, "Recipe: http://recipes.internal.example/curry"
    assert_nil page.structured_recipe
    assert_nil page.video_metadata["written_recipe_url"]
    assert_not_requested :get, "http://recipes.internal.example/curry"
  end

  test "a broken recipe link leaves the description to stand on its own" do
    stub_watch_page(description: "Recipe: #{RECIPE_URL}")
    stub_request(:get, RECIPE_URL).to_return(status: 500)
    page = fetch

    assert_nil page.structured_recipe
    assert_nil page.video_metadata["written_recipe_url"]
    assert_includes page.text, "Recipe: #{RECIPE_URL}"
  end

  test "a linked page cannot turn the written recipe link into a script or another site's URL" do
    stub_watch_page(description: "Recipe: #{RECIPE_URL}")
    [ "javascript:alert(1)", "https://evil.example/recipe" ].each do |canonical|
      stub_request(:get, RECIPE_URL).to_return(body: %(<link rel="canonical" href="#{canonical}"><main>Recipe</main>),
                                             headers: { "Content-Type" => "text/html" })

      assert_equal RECIPE_URL, fetch.video_metadata["written_recipe_url"]
    end
  end
end
