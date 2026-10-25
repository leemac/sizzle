module ApplicationHelper
  def appearance
    @appearance ||= Appearance.from_cookies(cookies)
  end

  # Every theme's tokens, keyed by the data-theme and data-mode attributes on <html>.
  # Built only from validated ids and #rrggbb colours, so escaping leaves it unchanged.
  # Custom themes get their own tag, which the page updates from the theme_css prop.
  def theme_style_tag
    safe_join([ tag.style(Theme.builtin_stylesheet), tag.style(Theme.custom_stylesheet, id: "sizzle-custom-themes") ], "\n")
  end
end
