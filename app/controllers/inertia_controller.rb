# frozen_string_literal: true

# Base for every page controller. Flash messages reach the client automatically
# (page.flash); shared props here are available on every page via usePage().
class InertiaController < ApplicationController
  inertia_share app: -> { { claude_configured: Sizzle.claude_configured?, version: Sizzle.version, theme_editor: Sizzle.theme_editor? } }
  inertia_share appearance: -> { helpers.appearance.as_props }
  # CSS for themes made in the editor, so one saved after this page loaded still shows.
  inertia_share theme_css: -> { Theme.custom_stylesheet }
  inertia_share preferences: -> { browser_preferences.as_props }

  private

  def browser_preferences
    BrowserPreferences.from_cookies(cookies)
  end
end
