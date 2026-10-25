# frozen_string_literal: true

InertiaRails.configure do |config|
  config.version = ViteRuby.digest
  # Web Crypto requires a secure origin; LAN HTTP is a supported install.
  config.encrypt_history = -> { request.ssl? }
  config.always_include_errors_hash = true
  config.use_script_element_for_initial_page = true
  config.use_data_inertia_head_attribute = true
  config.server_head = true
  # Titles are set in controllers with inertia_meta.add(title:) so the first HTML
  # response and every Inertia visit agree. Pages without one are just "Sizzle".
  config.meta_title_template = ->(title) { title.present? ? "#{title} · Sizzle" : "Sizzle" }
  config.convert_fragment_redirects = true
end
