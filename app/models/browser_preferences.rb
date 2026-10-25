# Preferences belong to this browser, not the whole household. Cookies are
# untrusted input: only these small, explicit choices may reach the application.
class BrowserPreferences
  include ActiveModel::Model

  CHOICES = {
    "text_size" => %w[standard large],
    "keep_awake" => %w[off on],
    "sort" => %w[newest alphabetical recently_cooked never_cooked],
    "ai_mode" => %w[ask automatic]
  }.freeze
  DEFAULTS = { "text_size" => "standard", "keep_awake" => "off", "sort" => "newest", "ai_mode" => "automatic" }.freeze

  attr_accessor(*CHOICES.keys)
  CHOICES.each do |name, values|
    validates name, inclusion: { in: values }
  end

  def self.from_cookies(cookies)
    new(CHOICES.to_h do |name, values|
      value = cookies["sizzle_#{name}"]
      [ name, values.include?(value) ? value : DEFAULTS.fetch(name) ]
    end)
  end

  def save(cookies, secure:)
    return false unless valid?

    as_props.each do |name, value|
      cookies.permanent["sizzle_#{name}"] = { value:, httponly: true, same_site: :lax, secure: }
    end
    true
  end

  def as_props = CHOICES.to_h { |name, _| [ name, public_send(name) ] }
end
