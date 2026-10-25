require "test_helper"

class CustomThemeTest < ActiveSupport::TestCase
  def colors = Theme.default.light.dup

  def build(**attributes)
    CustomTheme.new(name: "Midnight snack", light: colors, dark: Theme.default.dark.dup, **attributes)
  end

  test "becomes a theme with a custom id the picker and stylesheet can use" do
    custom = build(description: "  Late   night  ").tap(&:save!)

    theme = Theme.find(custom.theme_id)
    assert_equal "custom-#{custom.id}", theme.id
    assert theme.custom?
    assert_equal "Late night", theme.description
    assert_includes Theme.stylesheet, ":root[data-theme=custom-#{custom.id}]{"
  end

  test "rejects colours that could break out of the stylesheet" do
    [ "red", "#fff", "#123456;}body{display:none", "url(https://example.com/x)", nil, 7 ].each do |value|
      custom = build(dark: Theme.default.dark.merge("paper" => value))

      assert_not custom.valid?, value.inspect
      assert_includes custom.errors[:dark].sole, "paper must be a #rrggbb colour"
    end
  end

  test "needs every token and nothing else" do
    assert_includes build(light: colors.except("mark")).tap(&:valid?).errors[:light].sole, "missing mark"
    assert_includes build(light: colors.merge("background-image" => "#123456")).tap(&:valid?).errors[:light].sole, "unknown tokens"
    assert_includes build(light: "#123456").tap(&:valid?).errors[:light].sole, "needs colours"
  end

  test "stores colours in lowercase" do
    custom = build(light: colors.merge("action" => "#ABCDEF")).tap(&:save!)

    assert_equal "#abcdef", custom.reload.light["action"]
  end

  test "names are required, short and unique, including against built-in themes" do
    assert_not build(name: "  ").valid?
    assert_not build(name: "x" * 41).valid?
    assert_not build(name: "pesto").valid?

    build.save!
    assert_includes build(name: "MIDNIGHT SNACK").tap(&:valid?).errors[:name], "Another theme already has this name. Try a different one."
  end

  test "caps how many themes a server keeps" do
    CustomTheme::LIMIT.times { |n| build(name: "Theme #{n}").save!(validate: false) }

    custom = build(name: "One more")
    assert_not custom.valid?
    assert_match "up to #{CustomTheme::LIMIT} themes", custom.errors[:base].sole
  end

  test "only custom-<number> ids find a custom theme" do
    custom = build.tap(&:save!)

    assert_equal custom, CustomTheme.find_by_theme_id("custom-#{custom.id}")
    [ custom.id.to_s, "custom-#{custom.id}x", "custom-0#{custom.id}", "custom-", "pesto", nil ].each do |id|
      assert_nil CustomTheme.find_by_theme_id(id), id.inspect
    end
  end

  test "themes.json can't claim a custom id" do
    theme = { "id" => "custom-1", "name" => "Fake", "description" => "Fake.", "light" => colors, "dark" => colors }

    assert_raises(Theme::InvalidConfig, match: /reserved/) do
      Theme.load({ "default" => "custom-1", "themes" => [ theme ] }.to_json)
    end
  end
end
