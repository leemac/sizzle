require "strscan"

# Reads a YouTube video as recipe material. YouTube pages carry no schema.org
# Recipe, but many cooks put the recipe (or a link to it) in the description,
# which the watch page embeds in its ytInitialPlayerResponse JSON.
#
# Only the 11-character video ID is taken from the shared URL: we fetch a watch
# URL we build ourselves, and thumbnails come from that ID, not from the page.
# The description is written by the uploader, so it's as untrusted as any page.
class YoutubeVideo
  class Unavailable < StandardError; end

  ID_PATTERN = /\A[A-Za-z0-9_-]{11}\z/
  WATCH_HOSTS = %w[youtube.com www.youtube.com m.youtube.com].freeze
  SHORT_HOSTS = %w[youtu.be www.youtu.be].freeze
  ID_PATHS = %r{\A/(?:shorts|live|embed)/([^/?#]+)/?\z}

  MAX_HTML_BYTES = PageScraper::MAX_HTML_BYTES
  MAX_DESCRIPTION_CHARS = 10_000
  # Mobile browsers are redirected to m.youtube.com, which embeds the player data differently.
  USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " \
               "Chrome/130.0.0.0 Safari/537.36".freeze
  # Skips the cookie consent interstitial YouTube shows to visitors from the EU.
  CONSENT_COOKIE = "SOCS=CAI".freeze

  # Links that are never the recipe itself, even on a line that says "recipe".
  NOT_RECIPE_HOSTS = %w[
    youtube.com youtu.be instagram.com tiktok.com facebook.com x.com twitter.com threads.net pinterest.com
    amazon.com amzn.to patreon.com ko-fi.com buymeacoffee.com linktr.ee spotify.com
  ].freeze

  # Returns the video ID if `url` is a YouTube video link, otherwise nil.
  def self.id_from_url(url)
    uri = URI.parse(url.to_s.strip)
    return unless uri.is_a?(URI::HTTP)

    host = uri.host.to_s.downcase
    candidate =
      if SHORT_HOSTS.include?(host)
        uri.path.to_s.delete_prefix("/").delete_suffix("/")
      elsif WATCH_HOSTS.include?(host)
        if uri.path == "/watch"
          URI.decode_www_form(uri.query.to_s).assoc("v")&.last
        else
          uri.path.to_s[ID_PATHS, 1]
        end
      end
    candidate if candidate&.match?(ID_PATTERN)
  rescue URI::InvalidURIError, ArgumentError
    nil
  end

  def self.watch_url(id)
    raise ArgumentError, "invalid video id" unless id.to_s.match?(ID_PATTERN)

    "https://www.youtube.com/watch?v=#{id}"
  end

  def self.fetch(id, http: SafeHttp.new)
    new(id, http:).page
  end

  def initialize(id, http:)
    @id = id
    @url = self.class.watch_url(id)
    @http = http
  end

  # A PageScraper::Page whose text is the video's description. When the
  # description links to a recipe page, that page's schema.org data, text and
  # images come along so the usual extraction can use them.
  def page
    details = video_details
    title = text(details["title"], 300)
    description = text(details["shortDescription"], MAX_DESCRIPTION_CHARS)
    linked = linked_recipe_page(description)

    sections = [ "Video title: #{title}", "Video description:\n#{description || '(none)'}" ]
    sections << "Linked recipe page (#{linked.canonical_url}):\n#{linked.text}" if linked&.text.present?
    page_text = sections.join("\n\n")
    truncated = page_text.length > PageScraper::MAX_TEXT_CHARS

    PageScraper::Page.new(
      url: @url,
      canonical_url: @url,
      title:,
      site_name: text(details["author"], PageScraper::MAX_SITE_NAME_CHARS)&.squish,
      description: nil,
      structured_recipe: linked&.structured_recipe,
      text: truncated ? page_text[0, PageScraper::MAX_TEXT_CHARS] : page_text,
      images: images(linked),
      truncated: truncated || linked&.truncated || false
    )
  end

  private

  def video_details
    response = @http.get(@url, max_bytes: MAX_HTML_BYTES,
                               headers: { "User-Agent" => USER_AGENT, "Cookie" => CONSENT_COOKIE })
    json = player_response_json(response.body) or raise Unavailable, "Couldn't read this YouTube video's details."
    player = JSON.parse(json)
    details = player["videoDetails"]

    unless details.is_a?(Hash) && details["videoId"] == @id
      raise Unavailable, unavailable_message(player["playabilityStatus"])
    end

    details
  rescue JSON::ParserError
    raise Unavailable, "Couldn't read this YouTube video's details."
  end

  def unavailable_message(status)
    status = {} unless status.is_a?(Hash)
    if status["status"] == "LOGIN_REQUIRED"
      "YouTube asked Sizzle to sign in, so it can't read this video from your server. Write the recipe manually instead."
    else
      "This YouTube video isn't available. It may be private or removed."
    end
  end

  # The player JSON is a JavaScript assignment, not a standalone document, so
  # find where the object ends by matching braces outside of strings.
  def player_response_json(html)
    scanner = StringScanner.new(html.to_s.b)
    scanner.skip_until(/var ytInitialPlayerResponse\s*=\s*(?=\{)/) or return
    start = scanner.pos
    depth = 0
    in_string = false

    while scanner.skip_until(in_string ? /["\\]/ : /[{}"]/)
      case scanner.matched
      when "\\" then scanner.pos += 1 unless scanner.eos?
      when '"' then in_string = !in_string
      when "{" then depth += 1
      when "}"
        depth -= 1
        return scanner.string.byteslice(start...scanner.pos).force_encoding(Encoding::UTF_8).scrub if depth.zero?
      end
    end
    nil
  end

  # Follows one "recipe" link from the description. It's optional: anything
  # that goes wrong leaves the description to stand on its own.
  def linked_recipe_page(description)
    url = recipe_link(description) or return
    PageScraper.fetch(url, http: @http)
  rescue SafeHttp::Error => e
    Rails.logger.info("[YoutubeVideo] skipped linked recipe page: #{e.message}")
    nil
  end

  # A link on a line that mentions "recipe", or right under a label such as "Full recipe:".
  def recipe_link(description)
    label = false
    description.to_s.each_line do |line|
      next if line.strip.empty?

      if line.match?(/recipe/i) || label
        line.scan(%r{https?://[^\s<>"]+}i) { |url| return url if recipe_host?(url) }
      end
      label = line.match?(/recipe/i) && line.strip.match?(/[:👇⬇↓]\z/)
    end
    nil
  end

  def recipe_host?(url)
    host = URI.parse(url).host.to_s.downcase.delete_prefix("www.")
    host.present? && NOT_RECIPE_HOSTS.none? { |blocked| host == blocked || host.end_with?(".#{blocked}") }
  rescue URI::InvalidURIError
    false
  end

  # The linked page's photos come first; thumbnails are always a fallback.
  # hqdefault (480x360) is too small for RecipeImages, so it's left out.
  def images(linked)
    thumbnails = %w[maxresdefault sddefault].map { |name| "https://i.ytimg.com/vi/#{@id}/#{name}.jpg" }
    candidates = (linked&.images || []).map { |image| [ image.url, image.alt, image.source ] }
    candidates += thumbnails.map { |url| [ url, nil, "video thumbnail" ] }

    candidates.uniq(&:first).first(PageScraper::MAX_IMAGES).each_with_index.map do |(url, alt, source), index|
      PageScraper::Image.new(id: "img#{index + 1}", url:, alt:, source:)
    end
  end

  def text(value, max)
    value.strip.presence&.truncate(max) if value.is_a?(String)
  end
end
