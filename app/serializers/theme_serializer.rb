# Themes with their colours, for the theme picker's previews and the editor.
module ThemeSerializer
  extend self

  def call
    Theme.all.map { |theme| theme(theme) }
  end

  def theme(theme)
    {
      id: theme.id,
      name: theme.name,
      description: theme.description,
      light: theme.light,
      dark: theme.dark,
      custom_id: theme.custom_id
    }
  end

  # What the editor starts from: a saved custom theme, or a copy of any theme.
  def draft(custom_theme)
    {
      id: custom_theme.id,
      name: custom_theme.name.to_s,
      description: custom_theme.description.to_s,
      light: custom_theme.light,
      dark: custom_theme.dark
    }
  end
end
