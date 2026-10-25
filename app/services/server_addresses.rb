# This machine's addresses on the home network and Tailscale, for when Sizzle
# was opened through localhost and a phone needs a different way in. Inside a
# container these would be the container's own addresses, which nothing outside
# can reach, so it reports none there.
class ServerAddresses
  CONTAINER_MARKERS = %w[/.dockerenv /run/.containerenv].freeze
  TAILSCALE = IPAddr.new("100.64.0.0/10")

  def self.loopback_host?(host)
    host = host.to_s.delete_prefix("[").delete_suffix("]")
    host == "localhost" || IPAddr.new(host).loopback?
  rescue IPAddr::Error
    false
  end

  def initialize(interfaces: Socket.ip_address_list, container: CONTAINER_MARKERS.any? { |path| File.exist?(path) })
    @interfaces = interfaces
    @container = container
  end

  # [{ ip: "192.168.1.20", network: "home" }, { ip: "100.101.102.103", network: "tailscale" }]
  def reachable
    return [] if @container

    ips = @interfaces.select(&:ipv4?).map { |interface| IPAddr.new(interface.ip_address) }.uniq
    home = ips.select(&:private?).map { |ip| { ip: ip.to_s, network: "home" } }
    tailscale = ips.select { |ip| TAILSCALE.include?(ip) }.map { |ip| { ip: ip.to_s, network: "tailscale" } }
    home + tailscale
  end
end
