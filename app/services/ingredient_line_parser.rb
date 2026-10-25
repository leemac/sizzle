# A conservative grammar for plain ingredient lines. Scans are anchored or single
# passes; no recursive parsing or fetching of anything in the source text.
class IngredientLineParser
  FRACTIONS = { "¼" => 0.25, "½" => 0.5, "¾" => 0.75, "⅐" => 1.0 / 7,
                "⅑" => 1.0 / 9, "⅒" => 0.1, "⅓" => 1.0 / 3, "⅔" => 2.0 / 3,
                "⅕" => 0.2, "⅖" => 0.4, "⅗" => 0.6, "⅘" => 0.8,
                "⅙" => 1.0 / 6, "⅚" => 5.0 / 6, "⅛" => 0.125,
                "⅜" => 0.375, "⅝" => 0.625, "⅞" => 0.875 }.freeze
  GLYPHS = FRACTIONS.keys.join.freeze
  NUMBER = /\A(?:\d++(?:[[:space:]]++(?:and[[:space:]]++)?|-)\d++\/\d++|\d++\/\d++|\d++[[:space:]]*+[#{GLYPHS}]|[#{GLYPHS}]|\d++\.\d++|\.\d++|\d++)/
  UNITS = {
    "cup" => %w[cup cups], "tsp" => %w[tsp tsps teaspoon teaspoons],
    "tbsp" => %w[tbsp tbsps tablespoon tablespoons], "g" => %w[g gs gram grams],
    "kg" => %w[kg kgs kilogram kilograms], "mg" => %w[mg mgs milligram milligrams],
    "ml" => %w[ml mls milliliter milliliters millilitre millilitres],
    "l" => %w[l ls liter liters litre litres], "oz" => %w[oz ounce ounces],
    "lb" => %w[lb lbs], "pound" => %w[pound pounds], "fl oz" => [ "fl oz", "fluid ounce", "fluid ounces" ],
    "pint" => %w[pint pints], "quart" => %w[quart quarts], "gallon" => %w[gallon gallons],
    "clove" => %w[clove cloves], "can" => %w[can cans], "pinch" => %w[pinch pinches],
    "pinch of" => [ "pinch of", "pinches of" ], "handful" => %w[handful handfuls],
    "slice" => %w[slice slices], "bunch" => %w[bunch bunches],
    "jar" => %w[jar jars], "bottle" => %w[bottle bottles], "packet" => %w[packet packets]
  }.flat_map { |unit, names| names.map { |name| [ name, unit ] } }.to_h.freeze
  UNIT = /\A(#{Regexp.union(UNITS.keys.sort_by { |name| -name.length }).source})\.?(?=\s|\(|\z)/i

  def self.parse(line)
    new(line).parse
  end

  def initialize(line)
    @line = line
    @result = { "section" => nil, "quantity" => nil, "quantity_max" => nil, "unit" => nil,
                "item" => line, "preparation" => nil, "note" => nil }
  end

  def parse
    return @result unless @line.is_a?(String) && @line.length <= RecipeText::MAX_INGREDIENT_LENGTH

    rest = @line.squish
    amount = NUMBER.match(rest)
    if amount
      quantity = number(amount[0])
      return @result unless valid_quantity?(quantity)

      rest = rest[amount[0].length..]
      if (range = /\A\s*+(?:-|–|to\b)\s*+/.match(rest))
        upper = NUMBER.match(rest[range[0].length..])
        return @result unless upper

        maximum = number(upper[0])
        return @result unless valid_quantity?(maximum) && maximum >= quantity

        maximum = nil if maximum == quantity
        rest = rest[(range[0].length + upper[0].length)..]
      end
      # An attached token must be a known unit, not a size such as "2-inch".
      return @result if rest.present? && !rest.start_with?(" ", "\t") && !UNIT.match?(rest)

      rest = rest.lstrip
      unit = UNIT.match(rest)
      rest = rest[unit[0].length..].lstrip if unit
      notes = []
      if rest.start_with?("/")
        alternate = rest[1..].lstrip
        other_amount = NUMBER.match(alternate)
        return @result unless other_amount && valid_quantity?(number(other_amount[0]))

        other_unit = UNIT.match(alternate[other_amount[0].length..].lstrip)
        return @result unless other_unit

        consumed = other_amount[0].length + alternate[other_amount[0].length..].length - alternate[other_amount[0].length..].lstrip.length + other_unit[0].length
        notes << alternate[0...consumed]
        rest = alternate[consumed..].lstrip
      end
    else
      notes = []
    end

    body = extract_notes(rest, notes)
    return @result unless body

    # A package size may precede the container: "1 (14 oz) can tomatoes".
    # Recognizing it here also keeps the rendered edit line reversible.
    if amount && !unit && (unit = UNIT.match(body.lstrip))
      body = body.lstrip[unit[0].length..]
    end
    item, preparation = amount ? body.split(",", 2) : [ body, nil ]
    item = clean(item)
    return @result if item.blank? || (amount && !item.match?(/[\p{L}]/))
    return @result if !amount && NUMBER.match?(item)

    @result.merge("quantity" => quantity, "quantity_max" => maximum,
                  "unit" => (UNITS[unit[1].downcase] if unit), "item" => item,
                  "preparation" => clean(preparation).presence, "note" => notes.join("; ").presence)
  end

  private

  def number(token)
    glyph = FRACTIONS[token[-1]]
    return token[0...-1].to_f + glyph if glyph
    return token.to_f unless token.include?("/")

    parts = token.split(/[[:space:]\/-]+/).reject { |part| part == "and" }.map(&:to_f)
    denominator = parts.pop
    numerator = parts.pop
    return unless denominator.positive?

    (parts.first || 0) + (numerator / denominator)
  end

  def valid_quantity?(value)
    value && value.finite? && value.between?(0, RecipeDraft::MAX_QUANTITY)
  end

  # Flatten nested brackets in one pass, discarding only standalone footnote
  # pointers. Unbalanced brackets make the entire line fall back unchanged.
  def extract_notes(text, notes)
    text = text.gsub(/\(\s*+Note\s++\d++\s*+\)/i, " ")
    body = +""
    note = +""
    depth = 0
    text.each_char do |char|
      case char
      when "("
        note << " " if depth.positive?
        depth += 1
      when ")"
        return nil if depth.zero?

        depth -= 1
        note << " " if depth.positive?
        if depth.zero?
          value = clean(note)
          notes << value if value.present?
          note = +""
          body << " "
        end
      else
        (depth.zero? ? body : note) << char
      end
    end
    body if depth.zero?
  end

  def clean(text)
    text = text.to_s.strip
    # Preserve the draft clamp's truncation marker on edit round trips.
    ellipsis = text.end_with?("...") ? "..." : ""
    text = text.delete_suffix(ellipsis) if ellipsis.present?
    text.sub(/\A[,;]\s*+/, "").reverse.sub(/\A[\s*,;:.]++/, "").reverse.squish + ellipsis
  end
end
