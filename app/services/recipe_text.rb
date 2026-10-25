# Convert recipe fields to plain text without loading any referenced resources.
module RecipeText
  module_function

  MAX_ITEMS = 200
  MAX_INGREDIENT_LENGTH = 2000
  MAX_STEP_LENGTH = 10_000
  HEADING = /\A#+(\s+|\z)/ # "# Sauce", but not "#10 can tomatoes"
  MAX_SECTION_LENGTH = 300
  # Control characters, zero-width spaces and bidi overrides can hide text or make it read in a different order
  # than it's stored. Tabs, newlines and the joiners that emoji and some scripts need are kept.
  INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​‪-‮⁠⁦-⁩﻿]/

  def visible(value)
    value.to_s.gsub(INVISIBLE, "")
  end

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
    # Normalize before parsing too, so reprocessing old data is idempotent.
    bounded = visible(text).strip.truncate(MAX_INGREDIENT_LENGTH)
    parsed = IngredientLineParser.parse(bounded)
    RecipeDraft.new({ "ingredients" => [ parsed ] }).ingredients.first
  end
end
