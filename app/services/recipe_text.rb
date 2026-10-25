# Convert recipe fields to plain text without loading any referenced resources.
module RecipeText
  module_function

  MAX_ITEMS = 200
  MAX_INGREDIENT_LENGTH = 2000
  MAX_STEP_LENGTH = 10_000
  HEADING = /\A#+(\s+|\z)/ # "# Sauce", but not "#10 can tomatoes"
  MAX_SECTION_LENGTH = 300

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

  def sectioned_lines(value)
    section = nil
    lines(value).filter_map do |line|
      if line.match?(HEADING)
        section = line.sub(HEADING, "").presence&.truncate(MAX_SECTION_LENGTH)
        next
      end
      [ section, line ]
    end
  end

  def ingredient(text)
    { "section" => nil, "quantity" => nil, "quantity_max" => nil, "unit" => nil,
      "item" => text, "preparation" => nil, "note" => nil }
  end
end
