# Setup instructions for sharing into Sizzle from a phone.
class ShareController < InertiaController
  def show
    render inertia: "share/show", props: {
      endpoint: api_imports_url,
      shortcut_endpoints:,
      token_required: Sizzle.api_token.present?
    }
  end

  private

  # A phone can't use localhost, so when the page was opened on the server itself,
  # offer the server's network addresses instead.
  def shortcut_endpoints
    return [ { url: api_imports_url, network: nil } ] unless ServerAddresses.loopback_host?(request.host)

    ServerAddresses.new.reachable.map { |address| { url: api_imports_url(host: address[:ip]), network: address[:network] } }
  end
end
