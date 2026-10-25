# frozen_string_literal: true

# Base for every page controller. Flash messages reach the client automatically
# (page.flash); shared props here are available on every page via usePage().
class InertiaController < ApplicationController
  inertia_share app: -> { { claude_configured: Sizzle.claude_configured?, version: Sizzle.version } }
  inertia_share appearance: -> { helpers.appearance.as_props }
  # CSS for themes made in the editor, so one saved after this page loaded still shows.
  inertia_share theme_css: -> { Theme.custom_stylesheet }
end
