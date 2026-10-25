# Every theme with its colours, for the theme picker's previews.
module ThemeSerializer
  extend self

  def call
    Theme.all.map do |theme|
      { id: theme.id, name: theme.name, description: theme.description, light: theme.light, dark: theme.dark }
    end
  end
end
