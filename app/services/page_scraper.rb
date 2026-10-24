# Turns a fetched HTML page into the raw material for RecipeExtractor:
# readable text with the chrome stripped, any schema.org Recipe data, and a
# ranked list of candidate images. It does not decide what the recipe *is* —
# that's Claude's job — it just gets the junk out of the way cheaply.
class PageScraper
  Page = Data.define(:url, :canonical_url, :title, :site_name, :description, :structured_recipe, :text, :images,
                     :truncated)
  Image = Data.define(:id, :url, :alt, :source)

  MAX_HTML_BYTES = 6.megabytes
  MAX_TEXT_CHARS = 60_000
  MAX_IMAGES = 20

  JUNK_SELECTORS = %w[
    script style noscript template svg iframe object embed canvas form button select input textarea
    nav header footer aside dialog
    [aria-hidden=true] [hidden] [role=navigation] [role=banner] [role=contentinfo] [role=complementary]
    [class*=comment] [id*=comment] [class*=newsletter] [class*=subscribe] [class*=share] [class*=social]
    [class*=related] [class*=sidebar] [class*=advert] [class*=ad-slot] [class*=adthrive] [class*=cookie]
    [class*=popup] [class*=modal] [class*=breadcrumb] [class*=jump-to]
  ].join(",").freeze

  BLOCK_ELEMENTS = %w[p li h1 h2 h3 h4 h5 h6 div tr section article ul ol table blockquote figcaption dt dd].freeze
  JUNK_IMAGE_PATTERN = /logo|avatar|icon|sprite|gravatar|badge|pixel|spacer|emoji|\bads?\b|banner|pinit|pinterest/i

  def self.fetch(url, http: SafeHttp.new)
    response = http.get(url, max_bytes: MAX_HTML_BYTES)
    unless response.content_type.to_s.include?("html")
      raise SafeHttp::BadResponse, "expected a web page but got #{response.content_type.presence || 'unknown content'}"
    end

    parse(response.body, base_url: response.url)
  end

  def self.parse(html, base_url:)
    new(html, base_url).page
  end

  def initialize(html, base_url)
    @doc = Nokogiri::HTML5(html.to_s.scrub, max_errors: 0)
    @base_url = base_url
  end

  def page
    structured = structured_recipe
    text, truncated = readable_text

    Page.new(
      url: @base_url,
      canonical_url: trusted_canonical_url || @base_url,
      title: meta("og:title") || @doc.at_css("title")&.text&.strip,
      site_name: meta("og:site_name"),
      description: meta("og:description") || meta("description"),
      structured_recipe: structured,
      text:,
      images: image_candidates(structured),
      truncated:
    )
  end

  private

  # The page picks its own canonical link, so a hostile page could claim another
  # site's URL (and with it that recipe's duplicate check) or a javascript: URL.
  # Only trust an http(s) canonical on the host we actually fetched.
  def trusted_canonical_url
    url = absolute(@doc.at_css("link[rel=canonical]")&.[]("href")) or return
    uri = URI.parse(url)
    url if uri.is_a?(URI::HTTP) && same_host?(uri.host, URI.parse(@base_url).host)
  rescue URI::InvalidURIError
    nil
  end

  def same_host?(a, b)
    a.present? && a.downcase.delete_prefix("www.") == b.to_s.downcase.delete_prefix("www.")
  end

  # --- schema.org ------------------------------------------------------------

  def structured_recipe
    @doc.css('script[type="application/ld+json"]').each do |script|
      found = find_recipe_node(JSON.parse(script.text))
      return found if found
    rescue JSON::ParserError
      next
    end
    nil
  end

  def find_recipe_node(node)
    case node
    when Array
      node.each { |child| (found = find_recipe_node(child)) and return found }
      nil
    when Hash
      return node if Array(node["@type"]).any? { |type| type.to_s.casecmp?("Recipe") }

      find_recipe_node(node["@graph"]) || find_recipe_node(node["mainEntity"])
    end
  end

  # --- text ------------------------------------------------------------------

  def readable_text
    body = @doc.at_css("body")&.dup || @doc.root
    return [ "", false ] unless body

    body.css(JUNK_SELECTORS).each(&:remove)
    root = largest_content_root(body)
    root.css("br").each { |br| br.replace("\n") }
    root.css(BLOCK_ELEMENTS.join(",")).each { |el| el.add_next_sibling("\n") }

    text = root.text.gsub(/[ \t ]+/, " ").gsub(/ *\n */, "\n").gsub(/\n{3,}/, "\n\n").strip
    truncated = text.length > MAX_TEXT_CHARS
    [ truncated ? text[0, MAX_TEXT_CHARS] : text, truncated ]
  end

  # Prefer a recipe card or <article>/<main> when one holds most of the content.
  def largest_content_root(body)
    candidates = body.css("[class*=wprm-recipe-container], [class*=tasty-recipes], [class*=recipe-card], article, main, [role=main]")
    best = candidates.max_by { |node| node.text.length }
    best && best.text.length > 500 ? best : body
  end

  # --- images ----------------------------------------------------------------

  def image_candidates(structured)
    urls = []
    image_urls_from_json_ld(structured&.dig("image")).each { |url| urls << [ url, nil, "schema.org" ] }
    [ meta("og:image"), meta("og:image:secure_url"), meta("twitter:image") ].compact.each do |url|
      urls << [ url, nil, "social" ]
    end
    content_images.each { |url, alt| urls << [ url, alt, "page" ] }

    seen = Set.new
    urls.filter_map do |url, alt, source|
      absolute_url = absolute(url)
      next unless absolute_url&.start_with?("http")
      next if absolute_url.match?(/\.svg(\?|\z)/i) || absolute_url.match?(JUNK_IMAGE_PATTERN)

      key = absolute_url.sub(/-\d+x\d+(?=\.\w+(\?|\z))/, "").sub(/\?.*\z/, "")
      next unless seen.add?(key)

      [ absolute_url, alt, source ]
    end.first(MAX_IMAGES).each_with_index.map do |(url, alt, source), index|
      Image.new(id: "img#{index + 1}", url:, alt: alt&.strip&.truncate(120), source:)
    end
  end

  def image_urls_from_json_ld(image)
    case image
    when String then [ image ]
    when Array then image.flat_map { |item| image_urls_from_json_ld(item) }
    when Hash then [ image["url"] || image["contentUrl"] ].compact
    else []
    end
  end

  def content_images
    root = @doc.at_css("article, main, [role=main]") || @doc.at_css("body")
    return [] unless root

    root.css("img").filter_map do |img|
      next if img["width"].to_i.between?(1, 199) || img["height"].to_i.between?(1, 199)

      src = largest_srcset_url(img["data-srcset"] || img["srcset"]) ||
            img["data-lazy-src"] || img["data-src"] || img["src"]
      next if src.blank? || src.start_with?("data:")

      [ src, img["alt"] ]
    end
  end

  def largest_srcset_url(srcset)
    return if srcset.blank?

    srcset.split(",").map(&:strip).max_by { |entry| entry.split(/\s+/)[1].to_i }&.split(/\s+/)&.first
  end

  # --- helpers ---------------------------------------------------------------

  def meta(name)
    @doc.at_css(%(meta[property="#{name}"], meta[name="#{name}"]))&.[]("content")&.strip.presence
  end

  def absolute(url)
    return if url.blank?

    URI.join(@base_url, url.strip).to_s
  rescue URI::Error, ArgumentError
    nil
  end
end
