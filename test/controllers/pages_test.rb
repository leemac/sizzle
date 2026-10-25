require "test_helper"

# Smoke tests that every Inertia page renders with the props its component expects.
class PagesTest < ActionDispatch::IntegrationTest
  include ActiveJob::TestHelper

  setup do
    @recipe = Recipe.create!(title: "Chickpea Curry", course: "main", cuisine: "Indian", diets: [ "vegan" ],
                             ingredients: [ { "item" => "chickpeas", "quantity" => 1 } ], steps: [ { "text" => "Simmer." } ])
    @recipe.cover.attach(io: StringIO.new(sample_jpeg), filename: "cover.jpg", content_type: "image/jpeg")
  end

  test "gallery" do
    get root_url

    assert_response :success
    assert_equal "recipes/index", inertia.component
    assert_equal "dev", inertia.props[:app]["version"]
    card = inertia.props[:recipes].sole
    assert_equal "Chickpea Curry", card[:title]
    assert_match %r{\A/rails/active_storage/}, card[:image_url]
    assert_equal [ { "value" => "main", "count" => 1 } ], inertia.props[:facets]["courses"]
  end

  test "gallery filters and search" do
    Recipe.create!(title: "Apple Pie", course: "dessert")

    get root_url, params: { course: "dessert" }
    assert_equal [ "Apple Pie" ], inertia.props[:recipes].map { |r| r[:title] }

    get root_url, params: { q: "curry" }
    assert_equal [ "Chickpea Curry" ], inertia.props[:recipes].map { |r| r[:title] }
  end

  test "recipe page" do
    get recipe_url(@recipe)

    assert_response :success
    assert_equal "recipes/show", inertia.component
    assert_equal "Chickpea Curry", inertia.props[:recipe][:title]
    assert inertia.props[:recipe][:hero_url]
  end

  test "page titles name the page, then Sizzle" do
    { root_url => "Sizzle",
      recipe_url(@recipe) => "Chickpea Curry · Sizzle",
      edit_recipe_url(@recipe) => "Edit Chickpea Curry · Sizzle",
      imports_url => "Add a recipe · Sizzle",
      share_url => "Share from your phone · Sizzle",
      setup_url => "Set up · Sizzle" }.each do |url, title|
      get url
      assert_select "head title", count: 1, text: title
    end
  end

  test "Inertia visits carry the page title so it updates on navigation" do
    get recipe_url(@recipe), headers: { "X-Inertia" => "true", "X-Inertia-Version" => ViteRuby.digest }

    assert_includes response.parsed_body.dig("props", "head"), %(<title data-inertia="title">Chickpea Curry · Sizzle</title>)
  end

  test "imported recipe titles are escaped in the page title" do
    @recipe.update!(title: "Pie</title><script>alert(1)</script>")

    get recipe_url(@recipe)
    assert_select "head title", text: "Pie</title><script>alert(1)</script> · Sizzle"
    assert_select "head script", text: "alert(1)", count: 0

    get recipe_url(@recipe), headers: { "X-Inertia" => "true", "X-Inertia-Version" => ViteRuby.digest }
    assert_includes response.parsed_body.dig("props", "head").join, "Pie&lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt; · Sizzle"
  end

  test "deleting a recipe" do
    delete recipe_url(@recipe)

    assert_redirected_to root_url
    assert_not Recipe.exists?(@recipe.id)
  end

  test "imports page and creating an import from the web form" do
    get imports_url
    assert_equal "imports/index", inertia.component

    assert_enqueued_with(job: ImportJob) do
      post imports_url, params: { input: "https://example.com/pie" }
    end
    assert_redirected_to imports_url
    assert_equal "web", Import.last.origin
  end

  test "share setup page" do
    get share_url

    assert_equal "share/show", inertia.component
    assert_equal api_imports_url, inertia.props[:endpoint]
    assert_equal [ { "url" => api_imports_url, "network" => nil } ], inertia.props[:shortcut_endpoints]
  end

  test "share setup page never offers the phone a localhost address" do
    get "http://localhost/share"

    assert_equal "http://localhost/api/imports", inertia.props[:endpoint]
    inertia.props[:shortcut_endpoints].each do |endpoint|
      assert_not ServerAddresses.loopback_host?(URI(endpoint["url"]).host), endpoint["url"]
    end
  end

  test "history encryption is enabled over HTTPS and omitted for LAN HTTP" do
    get "http://192.168.1.20/", headers: { "X-Inertia" => "true", "X-Inertia-Version" => ViteRuby.digest }
    assert_response :success
    assert_not response.parsed_body["encryptHistory"]

    get "https://cookbook.example/", headers: { "X-Inertia" => "true", "X-Inertia-Version" => ViteRuby.digest }
    assert_response :success
    assert response.parsed_body["encryptHistory"]
  end

  test "sends a strict content security policy" do
    get root_url

    csp = response.headers["Content-Security-Policy"]
    assert_includes csp, "default-src 'self'"
    assert_includes csp, "frame-ancestors 'none'"
    assert_includes csp, "object-src 'none'"
  end
end
