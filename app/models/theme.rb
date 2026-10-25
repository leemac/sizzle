# A colour theme. The built-in ones come from config/themes.json; people can add
# their own in the editor (CustomTheme). Each sets the same role tokens for light
# and dark. Both are validated strictly because their ids and colours are written
# into the page's <style> and <html> attributes.
class Theme
  class InvalidConfig < StandardError; end

  PATH = Rails.root.join("config/themes.json")
  TOKENS = %w[porcelain paper ink graphite hairline action on-action active on-active mark accent danger on-danger].freeze
  ID_FORMAT = /\A[a-z][a-z0-9-]{0,39}\z/
  COLOR_FORMAT = /\A#\h{6}\z/

  attr_reader :id, :name, :description, :light, :dark, :custom_id

  def initialize(id:, name:, description:, light:, dark:, custom_id: nil)
    @id = id
    @name = name
    @description = description
    @light = light
    @dark = dark
    @custom_id = custom_id
  end

  def custom? = custom_id.present?

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
    def builtin = config.fetch(:themes)
    def all = builtin + CustomTheme.order(:created_at).map(&:to_theme)
    def default = config.fetch(:default)

    def find(id)
      return if id.blank?

      builtin.find { |theme| theme.id == id } || CustomTheme.find_by_theme_id(id)&.to_theme
    end

    def stylesheet = [ builtin_stylesheet, custom_stylesheet ].join("\n")

    # The built-in themes never change while the app runs, so their CSS is built once.
    def builtin_stylesheet = @builtin_stylesheet ||= builtin.map(&:css).join("\n")

    # Custom themes change as people save them, so the page refreshes this part after each visit.
    def custom_stylesheet = CustomTheme.order(:created_at).map { |custom| custom.to_theme.css }.join("\n")

    # What's wrong with a light or dark palette, or nil if it's fine.
    def palette_problem(colors)
      return "needs colours" unless colors.is_a?(Hash)

      missing = TOKENS - colors.keys
      extra = colors.keys - TOKENS
      return "is missing #{missing.join(', ')}" if missing.any?
      return "has unknown tokens #{extra.join(', ')}" if extra.any?

      bad = colors.find { |_token, value| !(value.is_a?(String) && value.match?(COLOR_FORMAT)) }
      "#{bad.first} must be a #rrggbb colour" if bad
    end

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
      raise InvalidConfig, "Theme id #{id} is reserved for themes made in the editor" if id.start_with?(CustomTheme::ID_PREFIX)

      %w[name description].each do |field|
        value = attributes[field]
        raise InvalidConfig, "Theme #{id} needs a #{field} under 120 characters" unless value.is_a?(String) && value.strip.present? && value.length < 120
      end

      new(id:, name: attributes["name"], description: attributes["description"],
          light: palette(id, "light", attributes["light"]), dark: palette(id, "dark", attributes["dark"]))
    end

    def palette(id, mode, colors)
      problem = palette_problem(colors)
      raise InvalidConfig, "Theme #{id} #{mode} #{problem}" if problem

      colors.transform_values(&:downcase).freeze
    end
  end

  private

  def declarations(colors) = colors.map { |token, value| "--color-#{token}:#{value};" }.join
end
