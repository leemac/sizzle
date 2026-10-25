# Setup instructions for sharing into Sizzle from a phone.
class ShareController < InertiaController
  def show
    inertia_meta.add(title: "Share from your phone")
    render inertia: "share/show", props: {
      endpoint: api_imports_url,
      shortcut_endpoints:,
      token_required: Sizzle.api_token.present?,
      shortcut_pairing: Sizzle.shortcut_pairing? ? {
        download_url: share_shortcut_path,
        shortcut_name: ShortcutConnection::SHORTCUT_NAME,
        connections: ShortcutConnection.visible.order(created_at: :desc).map { |connection|
          { id: connection.id, name: connection.name, connected: connection.connected_at.present? }
        }
      } : nil
    }
  end

  def shortcut
    return head :not_found unless Sizzle.shortcut_pairing?

    send_file Rails.root.join("config/shortcuts/save-to-sizzle.shortcut"),
      filename: "#{ShortcutConnection::SHORTCUT_NAME}.shortcut", type: "application/x-shortcut"
  end

  private

  # A phone can't use localhost, so when the page was opened on the server itself,
  # offer the server's network addresses instead.
  def shortcut_endpoints
    return [ { url: api_imports_url, network: nil } ] unless ServerAddresses.loopback_host?(request.host)

    ServerAddresses.new.reachable.map { |address| { url: api_imports_url(host: address[:ip]), network: address[:network] } }
  end
end
