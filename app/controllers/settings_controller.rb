class SettingsController < InertiaController
  def show
    inertia_meta.add(title: "Settings")
    render inertia: "settings/show", props: { instance: {
      api_protected: Sizzle.api_token.present?,
      theme_name: helpers.appearance.theme.name,
      recipe_count: Recipe.count,
      photo_count: ActiveStorage::Attachment.where(record_type: "Recipe").count,
      export_limits: { recipes: CookbookExport::MAX_RECIPES, mib: CookbookExport::MAX_BYTES / 1.megabyte,
                       photos: CookbookExport::MAX_PHOTOS, cooks: CookbookExport::MAX_COOKS,
                       image_mib: CookbookExport::MAX_IMAGE_BYTES / 1.megabyte,
                       metadata_mib: CookbookExport::MAX_METADATA_BYTES / 1.megabyte,
                       record_mib: CookbookExport::MAX_RECORD_BYTES / 1.megabyte,
                       build_seconds: CookbookExportRunner::BUILD_SECONDS, download_seconds: CookbookExport::DOWNLOAD_SECONDS }
    } }
  end

  def update
    preferences = browser_preferences
    preferences.assign_attributes(params.expect(preferences: BrowserPreferences::CHOICES.keys))
    if preferences.save(cookies, secure: request.ssl?)
      # A fixed destination, never an arbitrary return URL from the browser.
      destination = params[:return_to] == "cookbook" ? root_path(params.permit(*Recipe::Filterable::FILTER_KEYS).to_h) : settings_path
      redirect_to destination, notice: "Preferences saved."
    else
      redirect_to settings_path, inertia: { errors: preferences.errors.to_hash.transform_values(&:to_sentence) }
    end
  end
end
