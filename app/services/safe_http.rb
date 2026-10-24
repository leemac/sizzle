require "net/http"
require "resolv"
require "ipaddr"
require "timeout"

# The only way Sizzle code may fetch a URL that came from outside the app
# (shared links, email bodies, model output). It defends against SSRF:
#
# * http/https on ports 80/443 only, no userinfo in URLs
# * every hostname is resolved up front and *all* of its addresses must be
#   public; the socket is then pinned to the vetted IP so a DNS-rebinding
#   answer between check and connect can't redirect us inward
# * proxy environment variables (http_proxy, HTTP_PROXY, ...) are ignored,
#   since a proxy would re-resolve the hostname and undo the pinning
# * redirects are followed manually and each hop is re-validated
# * hard caps on redirects, timeouts and (decompressed) body size
#
# Set SIZZLE_ALLOW_PRIVATE_NETWORK_FETCH=true to permit private addresses.
class SafeHttp
  class Error < StandardError; end
  class BlockedUrl < Error; end
  class TooLarge < Error; end
  class BadResponse < Error; end
  class DeadlineExceeded < Error; end

  Response = Data.define(:url, :status, :content_type, :body)

  MAX_REDIRECTS = 5
  ALLOWED_PORTS = [ 80, 443 ].freeze
  DEFAULT_USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 " \
                       "(KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1".freeze

  BLOCKED_RANGES = %w[
    0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 169.254.0.0/16 172.16.0.0/12
    192.0.0.0/24 192.0.2.0/24 192.88.99.0/24 192.168.0.0/16 198.18.0.0/15
    198.51.100.0/24 203.0.113.0/24 224.0.0.0/4 240.0.0.0/4
    ::/128 ::1/128 64:ff9b::/96 100::/64 2001:db8::/32 fc00::/7 fe80::/10 ff00::/8
  ].map { |cidr| IPAddr.new(cidr) }.freeze

  def self.get(url, **options)
    new.get(url, **options)
  end

  def initialize(resolver: default_resolver, allow_private: Sizzle.allow_private_network_fetch?,
                 open_timeout: 5, read_timeout: 15, total_timeout: 30)
    @resolver = resolver
    @allow_private = allow_private
    @open_timeout = open_timeout
    @read_timeout = read_timeout
    @total_timeout = total_timeout
  end

  # Fetches `url` and returns a Response. `max_bytes` caps the decompressed
  # body; `accept` filters on the response's media type prefix (e.g. "image/").
  def get(url, max_bytes: 5.megabytes, accept: nil, headers: {})
    # Timeout uses CLOCK_MONOTONIC and covers DNS, headers, body reads and all
    # redirects in one budget, including a peer that never stops trickling bytes.
    Timeout.timeout(@total_timeout, DeadlineExceeded, "download deadline exceeded") do
      uri = validate_uri!(url)

      (MAX_REDIRECTS + 1).times do
        response = request(uri, max_bytes:, headers:)

        if response.is_a?(URI)
          uri = response
          next
        end

        if accept && !response.content_type.to_s.start_with?(accept)
          raise BadResponse, "unexpected content type #{response.content_type.inspect}"
        end

        return response
      end

      raise BadResponse, "too many redirects"
    end
  end

  # Raises BlockedUrl unless `url` is something we're willing to fetch.
  def validate_uri!(url)
    uri = URI.parse(url.to_s.strip)
    raise BlockedUrl, "only http(s) URLs are allowed" unless uri.is_a?(URI::HTTP) && uri.hostname.present?
    raise BlockedUrl, "credentials in URLs are not allowed" if uri.userinfo
    raise BlockedUrl, "port #{uri.port} is not allowed" unless @allow_private || ALLOWED_PORTS.include?(uri.port)

    uri
  rescue URI::InvalidURIError
    raise BlockedUrl, "invalid URL"
  end

  private

  def request(uri, max_bytes:, headers:)
    http = build_http(uri, resolve!(uri.hostname))

    req = Net::HTTP::Get.new(uri.request_uri)
    req["User-Agent"] = Sizzle.env("SIZZLE_USER_AGENT", DEFAULT_USER_AGENT)
    req["Accept-Language"] = "en-US,en;q=0.9"
    headers.each { |key, value| req[key] = value }

    http.start do |conn|
      conn.request(req) do |res|
        case res
        when Net::HTTPRedirection
          location = res["location"].presence or raise BadResponse, "redirect without location"
          return validate_uri!(URI.join(uri, location).to_s)
        when Net::HTTPSuccess
          if res.content_length && res.content_length > max_bytes
            raise TooLarge, "response is #{res.content_length} bytes"
          end

          body = +""
          res.read_body do |chunk|
            body << chunk
            raise TooLarge, "response exceeded #{max_bytes} bytes" if body.bytesize > max_bytes
          end
          return Response.new(url: uri.to_s, status: res.code.to_i,
                              content_type: res["content-type"].to_s.split(";").first&.strip&.downcase,
                              body:)
        else
          raise BadResponse, "HTTP #{res.code}"
        end
      end
    end
  rescue SocketError, SystemCallError, IOError, OpenSSL::SSL::SSLError, Net::OpenTimeout, Net::ReadTimeout,
         Net::WriteTimeout, Zlib::Error => e
    raise BadResponse, "#{e.class.name}: #{e.message}"
  end

  # Connects straight to the vetted IP. The explicit nil proxy matters: by default Net::HTTP
  # picks up http_proxy/HTTP_PROXY from the environment, and a proxy is sent the hostname and
  # resolves it again itself, which undoes the IP pinning (DNS rebinding, split-horizon DNS).
  def build_http(uri, ip)
    http = Net::HTTP.new(uri.hostname, uri.port, nil)
    http.max_retries = 0
    http.ipaddr = ip
    http.use_ssl = uri.scheme == "https"
    http.open_timeout = @open_timeout
    http.read_timeout = @read_timeout
    http.write_timeout = @read_timeout
    http
  end

  def resolve!(host)
    addresses = @resolver.getaddresses(host)
    raise BlockedUrl, "could not resolve #{host}" if addresses.empty?

    unless @allow_private
      blocked = addresses.find { |address| blocked_ip?(address) }
      raise BlockedUrl, "#{host} resolves to a non-public address" if blocked
    end

    addresses.first.to_s
  end

  def blocked_ip?(address)
    ip = IPAddr.new(address.to_s)
    ip = ip.native if ip.ipv6? && ip.ipv4_mapped?
    BLOCKED_RANGES.any? { |range| range.family == ip.family && range.include?(ip) }
  rescue IPAddr::InvalidAddressError
    true
  end

  def default_resolver
    dns = Resolv::DNS.new
    dns.timeouts = 3
    Resolv.new([ Resolv::Hosts.new, dns ])
  end
end
