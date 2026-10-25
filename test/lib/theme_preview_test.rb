require "test_helper"

class ThemePreviewTest < ActiveSupport::TestCase
  test "the README's theme graphic matches config/themes.json" do
    ThemePreview::LABELS.each_key do |scheme|
      assert_equal ThemePreview.svg(scheme), ThemePreview.path(scheme).read,
                   "docs/images/themes-#{scheme}.svg is out of date. Run bin/rails themes:preview."
    end
  end

  test "draws every theme with escaped text" do
    theme = Theme.new(id: "test", name: "Fish & chips", description: "<b>Crispy</b>",
                      light: Theme.default.light, dark: Theme.default.dark)

    svg = ThemePreview.svg("light", [ theme ])

    assert_includes svg, "Fish &amp; chips"
    assert_includes svg, "&lt;b&gt;Crispy&lt;/b&gt;"
    assert_includes svg, %(fill="#{Theme.default.dark['action']}")
  end
end
