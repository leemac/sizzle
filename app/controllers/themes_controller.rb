# The theme editor. Built-in themes can't be changed; "Customize" starts a new
# custom theme from a copy of one. Saving a theme also switches this browser to it.
class ThemesController < InertiaController
  rate_limit to: 20, within: 1.minute, only: %i[create update destroy]

  def new
    base = Theme.find(params[:from]) || helpers.appearance.theme
    draft = CustomTheme.new(name: copy_name(base), description: base.description, light: base.light, dark: base.dark)
    inertia_meta.add(title: "New theme")
    render inertia: "themes/edit", props: { theme: ThemeSerializer.draft(draft), based_on: base.name }
  end

  def create
    custom_theme = CustomTheme.new(theme_params)
    if custom_theme.save
      use(custom_theme)
      redirect_to appearance_path, notice: "Theme saved. You're using “#{custom_theme.name}” now."
    else
      redirect_back_or_to new_theme_path, inertia: { errors: errors_for(custom_theme) }
    end
  end

  def edit
    inertia_meta.add(title: "Edit #{custom_theme.name}")
    render inertia: "themes/edit", props: { theme: ThemeSerializer.draft(custom_theme), based_on: nil }
  end

  def update
    if custom_theme.update(theme_params)
      use(custom_theme)
      redirect_to appearance_path, notice: "Theme saved."
    else
      redirect_to edit_theme_path(custom_theme), inertia: { errors: errors_for(custom_theme) }
    end
  end

  def destroy
    custom_theme.destroy!
    redirect_to appearance_path, notice: "Deleted “#{custom_theme.name}”."
  end

  private

  def custom_theme
    @custom_theme ||= CustomTheme.find(params[:id])
  end

  def theme_params
    attributes = params.expect(theme: [ :name, :description, { light: Theme::TOKENS, dark: Theme::TOKENS } ]).to_h
    attributes.merge(attributes.slice("light", "dark").transform_values(&:to_h))
  end

  # Keeps this browser's light, dark or auto, and switches it to the saved theme.
  def use(custom_theme)
    Appearance.new(theme_id: custom_theme.theme_id, mode: helpers.appearance.effective_mode)
              .save(cookies, secure: request.ssl?)
  end

  def copy_name(base)
    name = "My #{base.name.downcase_first}"
    taken = Theme.all.map { |theme| theme.name.downcase }
    return name unless taken.include?(name.downcase)

    (2..).lazy.map { |n| "#{name} #{n}" }.find { |candidate| taken.exclude?(candidate.downcase) }
  end

  def errors_for(custom_theme)
    custom_theme.errors.to_hash.transform_values(&:to_sentence)
  end
end
