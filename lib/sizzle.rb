# Runtime configuration for Sizzle. Everything is read from ENV so a self-hoster
# can configure the app entirely from docker-compose / .env — see .env.example.
module Sizzle
  module_function

  def env(name, default = nil)
    value = ENV[name]
    value.nil? || value.strip.empty? ? default : value.strip
  end

  def env_bool(name, default: false)
    value = env(name)
    return default if value.nil?

    %w[1 true yes on].include?(value.downcase)
  end

  def env_list(name)
    env(name, "").split(",").map(&:strip).reject(&:empty?)
  end

  # --- Claude --------------------------------------------------------------

  def claude_model
    env("SIZZLE_CLAUDE_MODEL", "claude-opus-5-5")
  end

  def claude_effort
    env("SIZZLE_CLAUDE_EFFORT", "medium")
  end

  def claude_configured?
    env("ANTHROPIC_API_KEY").present?
  end

  # --- Ingest API ----------------------------------------------------------

  # Optional bearer token required by /api/*. Strongly recommended whenever the
  # app is reachable by anything other than you (see SECURITY.md).
  def api_token
    env("SIZZLE_API_TOKEN")
  end

  # --- Network -------------------------------------------------------------

  # Extra hostnames allowed in the Host header (DNS-rebinding protection).
  def allowed_hosts
    env_list("SIZZLE_HOSTS")
  end

  # Allow imports to fetch from private/loopback addresses. Off by default:
  # turning it on lets anyone who can submit an import probe your network.
  def allow_private_network_fetch?
    env_bool("SIZZLE_ALLOW_PRIVATE_NETWORK_FETCH")
  end
end
