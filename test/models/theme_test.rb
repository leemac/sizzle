require "test_helper"

class ThemeTest < ActiveSupport::TestCase
  # [foreground, background, minimum ratio]. Text needs 4.5:1, icons 3:1 (WCAG 2.2 AA).
  CONTRAST_PAIRS = [
    %w[ink porcelain 4.5], %w[ink paper 4.5], %w[graphite porcelain 4.5], %w[graphite paper 4.5],
    %w[on-action action 4.5], %w[on-active active 4.5], %w[ink mark 4.5], %w[accent paper 3],
    %w[danger porcelain 4.5], %w[danger paper 4.5], %w[on-danger danger 4.5]
  ].freeze

  def valid_theme(id = "pesto")
    colors = Theme::TOKENS.index_with { "#123456" }
    { "id" => id, "name" => "Pesto", "description" => "Green.", "light" => colors, "dark" => colors }
  end

  def load_themes(themes, default: themes.first&.dig("id"))
    Theme.load({ "default" => default, "themes" => themes }.to_json)
  end

  test "ships the six themes with the original look as the default" do
    assert_equal [ "Sunny side up", "Squid ink", "Hot sauce", "Pesto", "Beet it", "Blue plate special" ], Theme.all.map(&:name)
    assert_equal "sunny-side-up", Theme.default.id
  end

  test "every shipped theme is readable in light and dark" do
    failures = Theme.all.flat_map do |theme|
      %w[light dark].flat_map do |mode|
        colors = theme.tokens(mode)
        CONTRAST_PAIRS.filter_map do |foreground, background, minimum|
          ratio = contrast(colors.fetch(foreground), colors.fetch(background))
          "#{theme.id} #{mode}: #{foreground} on #{background} is #{ratio.round(2)}:1" if ratio < minimum.to_f
        end
      end
    end

    assert_empty failures
  end

  test "the stylesheet keys every theme and mode on html attributes" do
    css = Theme.stylesheet

    Theme.all.each do |theme|
      assert_includes css, ":root[data-theme=#{theme.id}]{--color-porcelain:#{theme.light['porcelain']};"
      assert_includes css, ":root[data-theme=#{theme.id}][data-mode=dark]{--color-porcelain:#{theme.dark['porcelain']};"
      assert_includes css, "@media (prefers-color-scheme: dark){:root[data-theme=#{theme.id}][data-mode=auto]"
    end
  end

  test "the stylesheet has nothing HTML escaping would change, so it renders as written" do
    assert_equal Theme.stylesheet, ERB::Util.html_escape(Theme.stylesheet)
  end

  test "rejects ids that could break out of a CSS selector or attribute" do
    [ "Pesto", "pesto]{}body{display:none}", "\"><script>", "pesto theme", "" ].each do |id|
      error = assert_raises(Theme::InvalidConfig) { load_themes([ valid_theme(id) ]) }
      assert_match "lowercase letters", error.message
    end
  end

  test "rejects colours that aren't #rrggbb" do
    [ "red", "#fff", "#12345g", "#123456;}body{display:none", "url(https://example.com/x)", 123 ].each do |value|
      theme = valid_theme
      theme["dark"] = theme["dark"].merge("paper" => value)

      error = assert_raises(Theme::InvalidConfig) { load_themes([ theme ]) }
      assert_match "#rrggbb", error.message
    end
  end

  test "rejects missing and unknown tokens" do
    missing = valid_theme
    missing["light"] = missing["light"].except("mark")
    assert_raises(Theme::InvalidConfig, match: /missing mark/) { load_themes([ missing ]) }

    extra = valid_theme
    extra["light"] = extra["light"].merge("background-image" => "#123456")
    assert_raises(Theme::InvalidConfig, match: /unknown tokens background-image/) { load_themes([ extra ]) }
  end

  test "rejects duplicate ids, an unknown default, an empty list and broken JSON" do
    assert_raises(Theme::InvalidConfig, match: /unique/) { load_themes([ valid_theme, valid_theme ]) }
    assert_raises(Theme::InvalidConfig, match: /not in the list/) { load_themes([ valid_theme ], default: "nope") }
    assert_raises(Theme::InvalidConfig, match: /"themes" list/) { load_themes([]) }
    assert_raises(Theme::InvalidConfig, match: /not valid JSON/) { Theme.load("{") }
  end

  test "rejects names and descriptions that are blank or too long" do
    assert_raises(Theme::InvalidConfig, match: /name/) { load_themes([ valid_theme.merge("name" => " ") ]) }
    assert_raises(Theme::InvalidConfig, match: /description/) { load_themes([ valid_theme.merge("description" => "x" * 200) ]) }
  end

  private

  def contrast(first, second)
    lighter, darker = [ luminance(first), luminance(second) ].sort.reverse
    (lighter + 0.05) / (darker + 0.05)
  end

  def luminance(hex)
    red, green, blue = hex.delete("#").scan(/../).map do |pair|
      value = pair.to_i(16) / 255.0
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055)**2.4
    end
    (0.2126 * red) + (0.7152 * green) + (0.0722 * blue)
  end
end
