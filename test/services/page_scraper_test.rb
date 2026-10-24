require "test_helper"

class PageScraperTest < ActiveSupport::TestCase
  setup do
    @page = PageScraper.parse(file_fixture_html("recipe_page.html"), base_url: "https://samskitchen.example.com/chickpea-curry?utm_source=x")
  end

  test "reads page metadata and the canonical URL" do
    assert_equal "Weeknight Chickpea Curry", @page.title
    assert_equal "Sam's Kitchen", @page.site_name
    assert_equal "https://samskitchen.example.com/chickpea-curry", @page.canonical_url
  end

  test "finds the schema.org Recipe inside an @graph" do
    assert_equal "Weeknight Chickpea Curry", @page.structured_recipe["name"]
  end

  test "keeps the recipe text and strips scripts, navigation and comments" do
    assert_includes @page.text, "Simmer everything for 20 minutes."
    refute_includes @page.text, "window.ads"
    refute_includes @page.text, "Join 40,000 subscribers"
    refute_includes @page.text, "Great recipe!!!"
    refute_includes @page.text, "Home Recipes About"
  end

  test "ranks image candidates: schema.org first, then social, then page images, skipping junk" do
    urls = @page.images.map(&:url)

    assert_equal "https://cdn.example.com/curry-1200x900.jpg", urls.first
    assert_includes urls, "https://cdn.example.com/curry-hero.jpg"
    assert_includes urls, "https://cdn.example.com/step-onions-800x600.jpg"
    refute(urls.any? { |url| url.include?("logo") || url.include?("tiny") })
    assert_equal %w[img1 img2 img3], @page.images.map(&:id)
  end

  test "ignores a canonical link to another site or a non-http URL" do
    [ "https://bigrecipes.example/chickpea-curry", "javascript:alert(1)", "data:text/html,hi", "//bigrecipes.example/x" ].each do |href|
      page = PageScraper.parse(%(<link rel="canonical" href="#{href}">), base_url: "https://samskitchen.example.com/curry")

      assert_equal "https://samskitchen.example.com/curry", page.canonical_url, href
    end
  end

  test "accepts a canonical link that only adds or drops www" do
    page = PageScraper.parse(%(<link rel="canonical" href="https://www.samskitchen.example.com/curry">),
                             base_url: "https://samskitchen.example.com/curry?ref=ig")

    assert_equal "https://www.samskitchen.example.com/curry", page.canonical_url
  end
end
