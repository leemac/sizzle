# frozen_string_literal: true

# Base for every page controller. Flash messages reach the client automatically
# (page.flash); shared props here are available on every page via usePage().
class InertiaController < ApplicationController
  inertia_share app: -> { { claude_configured: Sizzle.claude_configured? } }
end
