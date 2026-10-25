# JSON ingest endpoint used by the iOS Shortcut / share sheet and scripts.
#
#   POST /api/imports   { "url": "https://…" }  or  { "text": "…" }
#   GET  /api/imports/:id
#
# Authentication: when SIZZLE_API_TOKEN is set, requests need
# `Authorization: Bearer <token>`. Requests must be JSON — browsers can't send
# cross-site JSON without a CORS preflight (which we never approve), so a
# malicious web page can't make your browser submit imports.
class Api::ImportsController < ActionController::API
  include ActionController::HttpAuthentication::Token::ControllerMethods

  before_action :require_json, only: :create
  before_action :authenticate
  rate_limit to: 30, within: 1.minute, only: :create,
             with: -> { render json: { error: "Too many imports, slow down." }, status: :too_many_requests }

  def create
    import = if params[:url].present?
      Import.new(kind: "url", url: params[:url].to_s.strip, origin: "share")
    else
      Import.from_input(params[:text], origin: "share")
    end

    if import.valid? && !ImportBudget.charge(1, store: cache_store)
      return render json: { error: "Too many imports, slow down." }, status: :too_many_requests
    end

    if import.save
      render json: payload(import), status: :accepted
    else
      render json: { error: import.errors.full_messages.to_sentence }, status: :unprocessable_content
    end
  end

  def show
    render json: payload(Import.find(params[:id]))
  end

  private

  def require_json
    head :unsupported_media_type unless request.media_type == "application/json"
  end

  def authenticate
    expected = Sizzle.api_token
    return if expected.blank?

    authenticate_or_request_with_http_token do |token, _options|
      ActiveSupport::SecurityUtils.secure_compare(token, expected)
    end
  end

  def payload(import)
    ImportSerializer.call(import).merge(imports_url: imports_url)
  end
end
