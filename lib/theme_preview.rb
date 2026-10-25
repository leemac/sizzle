# Draws the README's theme graphic from config/themes.json: one card per theme
# with its light and dark looks side by side. GitHub shows the file matching the
# reader's own colour scheme, so there's one SVG per scheme; only the labels differ.
#
#   bin/rails themes:preview
module ThemePreview
  extend self

  DIR = Rails.root.join("docs/images")
  # Label colours that read on GitHub's light and dark pages.
  LABELS = {
    "light" => { name: "#1f2328", description: "#59636e" },
    "dark" => { name: "#f0f6fc", description: "#9198a1" }
  }.freeze
  FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif".freeze
  HEART = "M12 20s-7.5-4.6-9.2-9.4C1.6 7.2 3.8 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.2 0 5.4 2.7 4.2 6.1C19.5 15.4 12 20 12 20Z".freeze

  COLUMNS = 3
  CARD_WIDTH = 376
  GAP = 36
  PANEL_WIDTH = 182
  PANEL_HEIGHT = 196
  ROW_HEIGHT = 284
  WIDTH = (COLUMNS * CARD_WIDTH) + ((COLUMNS - 1) * GAP)

  def path(scheme) = DIR.join("themes-#{scheme}.svg")

  def write
    LABELS.each_key { |scheme| File.write(path(scheme), svg(scheme)) }
  end

  def svg(scheme, themes = Theme.all)
    height = (themes.size.fdiv(COLUMNS).ceil * ROW_HEIGHT) - 24
    cards = themes.each_with_index.map do |theme, index|
      card(theme, x: (index % COLUMNS) * (CARD_WIDTH + GAP), y: (index / COLUMNS) * ROW_HEIGHT, labels: LABELS.fetch(scheme))
    end

    <<~SVG
      <svg xmlns="http://www.w3.org/2000/svg" width="#{WIDTH}" height="#{height}" viewBox="0 0 #{WIDTH} #{height}" font-family="#{FONT}">
        <title>Sizzle's #{themes.size} themes, each shown in light and dark</title>
      #{cards.join("\n")}
      </svg>
    SVG
  end

  private

  def card(theme, x:, y:, labels:)
    <<~SVG.indent(2)
      <g transform="translate(#{x} #{y})">
        #{panel(theme.light, 'Light', x: 0)}
        #{panel(theme.dark, 'Dark', x: PANEL_WIDTH + 12)}
        <text x="2" y="#{PANEL_HEIGHT + 28}" font-size="17" font-weight="700" fill="#{labels[:name]}">#{escape(theme.name)}</text>
        <text x="2" y="#{PANEL_HEIGHT + 50}" font-size="13" fill="#{labels[:description]}">#{escape(theme.description)}</text>
      </g>
    SVG
  end

  # A tiny recipe page in one theme: the header button (action), a favorite chip
  # (active), a highlighted ingredient (mark) and the favorite heart (accent).
  def panel(c, mode, x:)
    <<~SVG.squish
      <g transform="translate(#{x} 0)">
      <rect width="#{PANEL_WIDTH}" height="#{PANEL_HEIGHT}" rx="16" fill="#{c['porcelain']}" stroke="#{c['hairline']}"/>
      <text x="14" y="27" font-size="14" font-weight="800" letter-spacing="-0.5" fill="#{c['ink']}">Sizzle</text>
      <rect x="112" y="12" width="56" height="21" rx="10.5" fill="#{c['action']}"/>
      <text x="140" y="26.5" font-size="10.5" font-weight="600" text-anchor="middle" fill="#{c['on-action']}">+ Add</text>
      <text x="14" y="64" font-size="19" font-weight="700" letter-spacing="-0.5" fill="#{c['ink']}">Lime spritz</text>
      <rect x="14" y="76" width="76" height="22" rx="11" fill="#{c['active']}"/>
      <path d="#{HEART}" transform="translate(21 81) scale(0.5)" fill="#{c['on-active']}"/>
      <text x="36" y="91" font-size="10.5" font-weight="500" fill="#{c['on-active']}">Favorited</text>
      <rect x="96" y="76.5" width="46" height="21" rx="10.5" fill="#{c['paper']}" stroke="#{c['hairline']}"/>
      <text x="119" y="91" font-size="10.5" text-anchor="middle" fill="#{c['ink']}">vegan</text>
      <rect x="14" y="110" width="154" height="56" rx="10" fill="#{c['paper']}" stroke="#{c['hairline']}"/>
      <rect x="24" y="128" width="88" height="7" fill="#{c['mark']}"/>
      <text x="24" y="133" font-size="11" fill="#{c['ink']}">40 g fresh ginger</text>
      <text x="24" y="153" font-size="11" fill="#{c['graphite']}">60 g caster sugar</text>
      <path d="#{HEART}" transform="translate(146 120) scale(0.5)" fill="#{c['accent']}"/>
      <text x="14" y="184" font-size="10.5" fill="#{c['graphite']}">#{mode}</text>
      </g>
    SVG
  end

  def escape(text) = ERB::Util.html_escape(text)
end
