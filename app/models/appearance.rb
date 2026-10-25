# How this browser shows Sizzle: a theme and light, dark or auto. Sizzle has no
# accounts, so the choice lives in two cookies. Only values from the allowlists
# are ever used; anything else falls back to the default.
class Appearance
  include ActiveModel::Model
  include ActiveModel::Attributes

  MODES = %w[light dark auto].freeze
  THEME_COOKIE = :sizzle_theme
  MODE_COOKIE = :sizzle_mode

  attribute :theme_id, :string
  attribute :mode, :string

  validates :theme_id, inclusion: { in: ->(_) { Theme.all.map(&:id) }, message: "Choose a theme" }
  validates :mode, inclusion: { in: MODES, message: "Choose light, dark or auto" }

  def self.from_cookies(cookies)
    new(theme_id: cookies[THEME_COOKIE], mode: cookies[MODE_COOKIE])
  end

  def theme = Theme.find(theme_id) || Theme.default
  def effective_mode = MODES.include?(mode) ? mode : "auto"

  # True once this browser has picked both a theme and a mode.
  def chosen? = valid?

  def save(cookies, secure:)
    return false unless valid?

    { THEME_COOKIE => theme_id, MODE_COOKIE => mode }.each do |name, value|
      cookies.permanent[name] = { value:, httponly: true, same_site: :lax, secure: }
    end
    true
  end

  # Browser-bar colours for <meta name="theme-color">, matching the mode.
  def theme_colors
    light = theme.light.fetch("porcelain")
    dark = theme.dark.fetch("porcelain")
    case effective_mode
    when "light" then { light:, dark: light }
    when "dark" then { light: dark, dark: }
    else { light:, dark: }
    end
  end

  def as_props
    { theme: theme.id, mode: effective_mode, chosen: chosen? }
  end
end
