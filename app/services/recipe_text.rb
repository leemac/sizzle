# Convert recipe fields to plain text without loading any referenced resources.
module RecipeText
  module_function

  MAX_ITEMS = 200
  MAX_INGREDIENT_LENGTH = 2000
  MAX_STEP_LENGTH = 10_000

  def plain(value)
    return "" unless value.is_a?(String)

    fragment = Nokogiri::HTML5.fragment(value.scrub, max_errors: 0)
    fragment.css("script, style, noscript, iframe, object, embed").remove
    fragment.css("br").each { |node| node.replace("\n") }
    fragment.css("p, li, div, h1, h2, h3, h4").each { |node| node.add_next_sibling("\n") }
    fragment.text.gsub(/[ \t\r ]+/, " ").gsub(/ *\n */, "\n").strip
  end

  def lines(value)
    plain(value).lines.map(&:strip).reject(&:empty?)
  end

  def ingredient(text)
    { "section" => nil, "quantity" => nil, "quantity_max" => nil, "unit" => nil,
      "item" => text, "preparation" => nil, "note" => nil }
  end
end
