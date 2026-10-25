# A colour theme from config/themes.json. Each theme sets the same role tokens
# for light and dark. The file is validated strictly on load because its ids and
# colours are written into the page's <style> and <html> attributes.
class Theme
  class InvalidConfig < StandardError; end

  PATH = Rails.root.join("config/themes.json")
  TOKENS = %w[porcelain paper ink graphite hairline action on-action active on-active mark accent danger on-danger].freeze
  ID_FORMAT = /\A[a-z][a-z0-9-]{0,39}\z/
  COLOR_FORMAT = /\A#\h{6}\z/

  attr_reader :id, :name, :description, :light, :dark

  def initialize(id:, name:, description:, light:, dark:)
    @id = id
    @name = name
    @description = description
    @light = light
    @dark = dark
  end

  def tokens(mode) = mode == "dark" ? dark : light

  # Unquoted attribute selectors keep the CSS free of characters HTML would escape.
  def css
    selector = ":root[data-theme=#{id}]"
    <<~CSS.squish
      #{selector}{#{declarations(light)}color-scheme:light}
      #{selector}[data-mode=dark]{#{declarations(dark)}color-scheme:dark}
      @media (prefers-color-scheme: dark){#{selector}[data-mode=auto]{#{declarations(dark)}color-scheme:dark}}
    CSS
  end

  class << self
    def all = config.fetch(:themes)
    def default = config.fetch(:default)
    def find(id) = all.find { |theme| theme.id == id }
    def stylesheet = @stylesheet ||= all.map(&:css).join("\n")

    # Parses and checks a themes document. Raises InvalidConfig with what to fix.
    def load(json)
      data = JSON.parse(json)
      raise InvalidConfig, "themes.json needs a \"themes\" list" unless data["themes"].is_a?(Array) && data["themes"].any?

      themes = data["themes"].map { |attributes| build(attributes) }
      ids = themes.map(&:id)
      raise InvalidConfig, "Theme ids must be unique" unless ids.uniq.size == ids.size

      default = themes.find { |theme| theme.id == data["default"] }
      raise InvalidConfig, "Default theme #{data['default'].inspect} is not in the list" unless default

      { themes: themes.freeze, default: }
    rescue JSON::ParserError => error
      raise InvalidConfig, "themes.json is not valid JSON: #{error.message}"
    end

    private

    def config = @config ||= load(PATH.read)

    def build(attributes)
      raise InvalidConfig, "Each theme must be an object" unless attributes.is_a?(Hash)

      id = attributes["id"]
      raise InvalidConfig, "Theme id #{id.inspect} must be lowercase letters, digits and dashes" unless id.is_a?(String) && id.match?(ID_FORMAT)

      %w[name description].each do |field|
        value = attributes[field]
        raise InvalidConfig, "Theme #{id} needs a #{field} under 120 characters" unless value.is_a?(String) && value.strip.present? && value.length < 120
      end

      new(id:, name: attributes["name"], description: attributes["description"],
          light: palette(id, "light", attributes["light"]), dark: palette(id, "dark", attributes["dark"]))
    end

    def palette(id, mode, colors)
      raise InvalidConfig, "Theme #{id} needs #{mode} colours" unless colors.is_a?(Hash)

      missing = TOKENS - colors.keys
      extra = colors.keys - TOKENS
      raise InvalidConfig, "Theme #{id} #{mode} is missing #{missing.join(', ')}" if missing.any?
      raise InvalidConfig, "Theme #{id} #{mode} has unknown tokens #{extra.join(', ')}" if extra.any?

      colors.each do |token, value|
        raise InvalidConfig, "Theme #{id} #{mode} #{token} must be a #rrggbb colour" unless value.is_a?(String) && value.match?(COLOR_FORMAT)
      end
      colors.transform_values(&:downcase).freeze
    end
  end

  private

  def declarations(colors) = colors.map { |token, value| "--color-#{token}:#{value};" }.join
end
