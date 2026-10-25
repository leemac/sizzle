# The existing ingest validations and rate limit apply, with a device credential
# in place of the server-wide API token. There is deliberately no read route.
class Api::ShortcutImportsController < Api::ImportsController
  prepend_before_action :require_pairing_enabled

  private

  def require_pairing_enabled
    head :not_found unless Sizzle.shortcut_pairing?
  end

  def authenticate
    authenticate_or_request_with_http_token do |token, _options|
      ShortcutConnection.authenticate(token).present?
    end
  end
end
