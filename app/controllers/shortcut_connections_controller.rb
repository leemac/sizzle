class ShortcutConnectionsController < ApplicationController
  before_action :require_pairing_enabled
  rate_limit to: 5, within: 1.minute, only: :create,
             with: -> { render json: { error: "Wait a minute before connecting another shortcut." }, status: :too_many_requests }

  def create
    connection, pairing_token = ShortcutConnection.issue!(name: params[:name].to_s.strip)
    setup = { sizzle_pairing: 1, pairing_url: api_shortcut_pairings_url, pairing_token: }
    # Shortcuts treats + literally; its custom URL scheme needs percent encoding,
    # rather than HTML form encoding (which represents a space as +).
    query = { name: ShortcutConnection::SHORTCUT_NAME, input: "text", text: setup.to_json }.map { |key, value|
      "#{ERB::Util.url_encode(key.to_s)}=#{ERB::Util.url_encode(value)}"
    }.join("&")
    response.headers["Cache-Control"] = "no-store"
    render json: { connect_url: "shortcuts://run-shortcut?#{query}", expires_at: connection.pairing_expires_at.iso8601 }
  rescue ActiveRecord::RecordInvalid, ArgumentError => e
    render json: { error: e.message }, status: :unprocessable_content
  end

  def destroy
    ShortcutConnection.find(params[:id]).revoke!
    redirect_to share_path, notice: "Shortcut disconnected."
  end

  private

  def require_pairing_enabled
    head :not_found unless Sizzle.shortcut_pairing?
  end
end
