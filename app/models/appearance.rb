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

  validate :theme_exists
  validates :mode, inclusion: { in: MODES, message: "Choose light, dark or auto" }

  def self.from_cookies(cookies)
    new(theme_id: cookies[THEME_COOKIE], mode: cookies[MODE_COOKIE])
  end

  # The chosen theme, built-in or custom. A deleted or unknown one falls back to the default.
  def theme = chosen_theme || Theme.default
  # Sizzle is dark until a browser chooses otherwise.
  DEFAULT_MODE = "dark"
  def effective_mode = MODES.include?(mode) ? mode : DEFAULT_MODE

  # For <meta name="color-scheme">, so form controls and scrollbars match before CSS loads.
  def color_scheme = { "light" => "light", "dark" => "dark" }.fetch(effective_mode, "light dark")

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

  private

  def chosen_theme
    return @chosen_theme if defined?(@chosen_theme) && @chosen_theme_id == theme_id

    @chosen_theme_id = theme_id
    @chosen_theme = Theme.find(theme_id)
  end

  def theme_exists
    errors.add(:theme_id, "Choose a theme") unless chosen_theme
  end
end
