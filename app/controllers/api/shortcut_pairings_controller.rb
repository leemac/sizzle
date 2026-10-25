class Api::ShortcutPairingsController < ActionController::API
  before_action :require_pairing_enabled
  before_action :require_json
  rate_limit to: 10, within: 1.minute,
             with: -> { render json: { error: "Too many connection attempts. Try again in a minute." }, status: :too_many_requests }

  def create
    response.headers["Cache-Control"] = "no-store"
    credential = ShortcutConnection.redeem(params[:pairing_token])
    if credential
      render json: { endpoint: api_shortcut_imports_url, token: credential }, status: :created
    else
      render json: { error: "This connection link expired or was already used. Connect again from Sizzle." }, status: :unauthorized
    end
  end

  private

  def require_pairing_enabled
    head :not_found unless Sizzle.shortcut_pairing?
  end

  def require_json
    head :unsupported_media_type unless request.media_type == "application/json"
  end
end
