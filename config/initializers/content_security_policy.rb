# Strict CSP: everything is served from our own origin. Imported recipe images
# are re-hosted locally, so no third-party image hosts are needed either.
# See https://guides.rubyonrails.org/security.html#content-security-policy-header

Rails.application.configure do
  config.content_security_policy do |policy|
    policy.default_src :self
    policy.base_uri :self
    policy.form_action :self
    policy.frame_ancestors :none
    policy.object_src :none
    policy.img_src :self, :data, :blob
    policy.font_src :self, :data
    policy.media_src :self, :blob
    policy.script_src :self
    policy.style_src :self, :unsafe_inline
    policy.connect_src :self

    if Rails.env.development?
      vite = "#{ViteRuby.config.protocol}://#{ViteRuby.config.host_with_port}"
      ws = "#{ViteRuby.config.https ? 'wss' : 'ws'}://#{ViteRuby.config.host_with_port}"
      policy.script_src(*policy.script_src, :unsafe_eval, vite)
      policy.style_src(*policy.style_src, vite)
      policy.connect_src(*policy.connect_src, vite, ws)
      policy.img_src(*policy.img_src, vite)
      policy.font_src(*policy.font_src, vite)
    end
  end

  # Nonces let the Vite React-refresh preamble (development) run without 'unsafe-inline'.
  config.content_security_policy_nonce_generator = ->(_request) { SecureRandom.base64(16) }
  config.content_security_policy_nonce_directives = %w[script-src]
end
