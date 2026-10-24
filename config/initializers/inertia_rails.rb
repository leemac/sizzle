# frozen_string_literal: true

InertiaRails.configure do |config|
  config.version = ViteRuby.digest
  # Web Crypto requires a secure origin; LAN HTTP is a supported install.
  config.encrypt_history = -> { request.ssl? }
  config.always_include_errors_hash = true
  config.use_script_element_for_initial_page = true
  config.use_data_inertia_head_attribute = true
  config.server_head = true
  config.convert_fragment_redirects = true
end
