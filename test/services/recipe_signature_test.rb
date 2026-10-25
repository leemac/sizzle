require "test_helper"

class RecipeSignatureTest < ActiveSupport::TestCase
  test "url keys ignore the forms one page can take" do
    key = RecipeSignature.url_key("https://example.com/pie?a=1&b=2")
    [ "http://www.example.com/pie/?b=2&a=1", "https://m.example.com/pie?a=1&b=2&utm_source=x#jump",
      "https://example.com/pie/amp?a=1&b=2", "https://EXAMPLE.com/pie?a=1&b=2&print=1" ].each do |url|
      assert_equal key, RecipeSignature.url_key(url), url
    end
    assert_not_equal key, RecipeSignature.url_key("https://example.com/pie?a=2&b=2")
    assert_not_equal key, RecipeSignature.url_key("https://example.com/tart?a=1&b=2")
    assert_equal RecipeSignature.url_key("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
      RecipeSignature.url_key("https://youtu.be/dQw4w9WgXcQ?si=abc")
  end

  test "url keys only exist for web links" do
    [ "javascript:alert(1)", "data:text/html,hi", "not a url", nil, "https://" ].each do |url|
      assert_nil RecipeSignature.url_key(url), url.inspect
    end
  end

  test "fingerprints match the same title and ingredients, ignoring case, accents, amounts and order" do
    one = RecipeSignature.fingerprint("Crème brûlée", [ { "item" => "Cream", "quantity" => 2 }, { "item" => "sugar" } ])
    assert_equal one, RecipeSignature.fingerprint("creme brulee!", [ { "item" => "sugar", "quantity" => 9 }, { "item" => "cream" } ])
    assert_not_equal one, RecipeSignature.fingerprint("Crème brûlée", [ { "item" => "cream" } ])
    assert_nil RecipeSignature.fingerprint("Crème brûlée", []), "a title alone is too weak to call a duplicate"
    assert_nil RecipeSignature.fingerprint(nil, [ { "item" => "cream" } ])
    assert_nil RecipeSignature.fingerprint("Tea", [ "not a hash", { "item" => 3 } ])
  end
end
