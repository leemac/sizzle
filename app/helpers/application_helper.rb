module ApplicationHelper
  def appearance
    @appearance ||= Appearance.from_cookies(cookies)
  end

  # Every theme's tokens, keyed by the data-theme and data-mode attributes on <html>.
  # Built only from validated ids and #rrggbb colours, so escaping leaves it unchanged.
  def theme_style_tag
    tag.style(Theme.stylesheet)
  end
end
