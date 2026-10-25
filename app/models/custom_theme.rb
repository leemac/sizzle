# A theme someone made in the editor, shared by everyone using this Sizzle.
# Colours are checked as strictly as themes.json, because they end up in the
# page's <style>. Its theme id is "custom-<id>", so it can never collide with
# a built-in one.
class CustomTheme < ApplicationRecord
  ID_PREFIX = "custom-".freeze
  LIMIT = 50

  normalizes :name, with: ->(name) { name.squish }
  normalizes :description, with: ->(description) { description.squish.presence }
  normalizes :light, :dark, with: ->(colors) { colors.is_a?(Hash) ? colors.transform_values { |value| value.is_a?(String) ? value.downcase : value } : colors }

  validates :name, presence: true, length: { maximum: 40 }
  validates :description, length: { maximum: 119 }
  validate :name_is_unique
  validate :palettes_are_complete
  validate :under_the_limit, on: :create

  def self.find_by_theme_id(theme_id)
    id = theme_id.to_s.delete_prefix(ID_PREFIX)
    find_by(id:) if theme_id.to_s.start_with?(ID_PREFIX) && id.match?(/\A[1-9]\d{0,9}\z/)
  end

  def theme_id = "#{ID_PREFIX}#{id}"

  def to_theme
    Theme.new(id: theme_id, name:, description: description.presence || "Made in the theme editor.",
              light: light.slice(*Theme::TOKENS), dark: dark.slice(*Theme::TOKENS), custom_id: id)
  end

  private

  def name_is_unique
    taken = Theme.builtin.map { |theme| theme.name.downcase } + CustomTheme.where.not(id:).pluck(:name).map(&:downcase)
    errors.add(:name, "Another theme already has this name. Try a different one.") if name.present? && taken.include?(name.downcase)
  end

  def palettes_are_complete
    { light:, dark: }.each do |mode, colors|
      problem = Theme.palette_problem(colors)
      errors.add(mode, problem) if problem
    end
  end

  def under_the_limit
    errors.add(:base, "You can keep up to #{LIMIT} themes. Delete one to make room.") if CustomTheme.count >= LIMIT
  end
end
