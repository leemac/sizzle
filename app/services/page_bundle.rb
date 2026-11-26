# Turns a fetched page into a self-contained bundle for the PDF renderer (Gotenberg): the page's HTML plus
# copies of the stylesheets, images and fonts it uses, each fetched through SafeHttp within shared budgets.
#
# The renderer has no network and may only read its own temporary folder, so the bundle must not refer to
# anything else. Every URL the page could load is rewritten to a file in the bundle or removed. Scripts,
# frames, embeds, media, SVG animation, refreshes and <base> are dropped. Links are kept only when they're
# http(s), because the renderer copies links into the PDF and the PDF is served from Sizzle's origin.
#
# Rewriting CSS is best-effort: a reference it misses simply doesn't load, because the renderer can't
# reach it. The attribute pass that runs last is strict: it removes every URL-bearing attribute that
# isn't a bundle file, a fragment, an inline image or an http(s) link.
class PageBundle
  Bundle = Data.define(:html, :files)

  MAX_FILES = 120
  MAX_FILE_BYTES = 5.megabytes
  MAX_TOTAL_BYTES = 40.megabytes
  MAX_IMPORT_DEPTH = 2
  FETCH_SECONDS = 60

  REMOVED_ELEMENTS = %w[script iframe frame frameset object embed applet base portal template video audio source
                        track link meta animate animateMotion animateTransform set discard].freeze
  URL_ATTRIBUTES = %w[src srcset href poster data background action formaction ping cite longdesc lowsrc dynsrc
                      manifest icon imagesrcset codebase classid archive profile usemap sizes].freeze
  LAZY_IMAGE_ATTRIBUTES = %w[data-src data-lazy-src data-original data-srcset data-lazy-srcset].freeze
  LINK_ELEMENTS = %w[a area].freeze

  CSS_IMPORT = /@import\s+(?:url\(\s*)?(?:"([^"]*)"|'([^']*)'|([^\s"');]+))\s*\)?([^;]*);/i
  CSS_URL = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s"')]*))\s*\)/i
  EMPTY_CSS_URL = 'url("data:,")'.freeze
  EXTENSIONS = {
    "image/jpeg" => ".jpg", "image/png" => ".png", "image/gif" => ".gif", "image/webp" => ".webp",
    "image/avif" => ".avif", "image/svg+xml" => ".svg", "font/woff2" => ".woff2", "font/woff" => ".woff",
    "application/font-woff" => ".woff", "font/ttf" => ".ttf", "font/otf" => ".otf"
  }.freeze

  def initialize(http: SafeHttp.new)
    @http = http
  end

  # `html` is the page as fetched; `url` is where it came from.
  def build(html, url:)
    @deadline = monotonic_time + FETCH_SECONDS
    @files = {}
    @fetched = {}
    @attempts = 0
    @bytes = 0
    @doc = Nokogiri::HTML5(decode(html), max_errors: 0)
    @base_url = document_base(url)

    rewrite_styles
    inline_stylesheets
    elements(REMOVED_ELEMENTS).each(&:remove)
    bundle_images
    clean_attributes
    declare_utf8

    Bundle.new(html: @doc.to_html(encoding: "UTF-8"), files: @files)
  end

  private

  # SafeHttp keeps no charset. A page that's valid UTF-8 is read as UTF-8; anything else is left for the
  # parser to sniff from the page's own <meta charset>.
  def decode(html)
    utf8 = html.to_s.dup.force_encoding(Encoding::UTF_8)
    utf8.valid_encoding? ? utf8 : html.to_s.b
  end

  # Elements by name in any namespace, so SVG's <script> and <a> count too.
  def elements(names)
    @doc.xpath("//*[#{names.map { |name| "local-name()='#{name}'" }.join(' or ')}]")
  end

  # <base href> moves where relative URLs point. An http(s) one is honoured; the element itself is removed.
  def document_base(url)
    href = elements(%w[base]).find { |base| base["href"].present? }&.[]("href")
    (href && absolute_http(url, href)) || url
  end

  def rewrite_styles
    elements(%w[style]).each { |style| style.content = escape_style(rewrite_css(style.content, @base_url)) }
    @doc.xpath("//*[@style]").each { |node| node["style"] = rewrite_css(node["style"], @base_url, imports: false) }
  end

  def inline_stylesheets
    elements(%w[link]).each do |link|
      rels = link["rel"].to_s.downcase.split
      next unless rels.include?("stylesheet") && !rels.include?("alternate") && !link.key?("disabled")

      href = absolute_http(@base_url, link["href"]) or next
      css = fetch_text(href) or next
      style = Nokogiri::XML::Node.new("style", @doc)
      style["media"] = link["media"] if link["media"].present?
      style.content = escape_style(rewrite_css(css, href))
      link.add_next_sibling(style)
    end
  end

  def bundle_images
    elements(%w[img]).each do |img|
      source = image_source(img)
      file = source && fetch_file(source, @base_url, accept: "image/")
      (LAZY_IMAGE_ATTRIBUTES + %w[srcset sizes loading]).each { |name| img.remove_attribute(name) }
      if file
        img["src"] = file
      elsif !img["src"].to_s.start_with?("data:image/")
        img.remove_attribute("src")
      end
    end
  end

  # Lazy-loading pages put the real image in a data attribute and a placeholder in src.
  def image_source(img)
    candidates = LAZY_IMAGE_ATTRIBUTES.map { |name| img[name] } + [ img["src"], img["srcset"] ]
    candidates.compact.map { |value| value.split(",").first.to_s.strip.split(/\s+/).first }
              .find { |value| value.present? && !value.start_with?("data:") }
  end

  # Imported stylesheets are set aside first and put back after this sheet's own url()s are rewritten, so
  # their already-rewritten urls aren't rewritten a second time against the wrong base.
  def rewrite_css(css, base_url, depth: 0, imports: true)
    imported = []
    css = css.to_s.scrub("").delete("\u0000").gsub(CSS_IMPORT) do
      imported << [ Regexp.last_match(1) || Regexp.last_match(2) || Regexp.last_match(3), Regexp.last_match(4).strip ]
      "\u0000#{imported.size - 1}\u0000"
    end
    rewrite_css_urls(css, base_url).gsub(/\u0000(\d+)\u0000/) do
      imports ? import_css(*imported.fetch(Regexp.last_match(1).to_i), base_url, depth) : ""
    end
  end

  def rewrite_css_urls(css, base_url)
    css.gsub(CSS_URL) do
      value = (Regexp.last_match(1) || Regexp.last_match(2) || Regexp.last_match(3)).to_s.strip
      if value.start_with?("data:", "#")
        %(url("#{value.gsub('"', '%22')}"))
      elsif (file = fetch_file(value, base_url))
        %(url("#{file}"))
      else
        EMPTY_CSS_URL
      end
    end
  end

  def import_css(href, media, base_url, depth)
    return "" if depth >= MAX_IMPORT_DEPTH

    url = absolute_http(base_url, href) or return ""
    css = fetch_text(url) or return ""
    rewritten = rewrite_css(css, url, depth: depth + 1)
    media.present? ? "@media #{media} {#{rewritten}}" : rewritten
  end

  # A stylesheet's text goes inside <style>, where "</style" would end the element early.
  def escape_style(css)
    css.gsub(%r{</(style)}i, '<\/\1')
  end

  # Every attribute that could make the renderer load or link to something is checked last.
  def clean_attributes
    @doc.traverse do |node|
      next unless node.element?

      node.attribute_nodes.each do |attribute|
        name = attribute.name.downcase
        if name.start_with?("on")
          attribute.remove
        elsif URL_ATTRIBUTES.include?(name)
          value = allowed_url(node, name, attribute.value)
          value ? attribute.value = value : attribute.remove
        end
      end
    end
  end

  # Bundle files, in-page fragments, inline images, and http(s) links on <a> and <area>.
  def allowed_url(node, name, value)
    value = value.to_s.strip
    return value if @files.key?(value) && %w[src href].include?(name)
    return value if %w[href usemap].include?(name) && value.match?(/\A#[^\s]*\z/)
    return value if name == "src" && node.name == "img" && value.start_with?("data:image/")
    return absolute_http(@base_url, value) if name == "href" && LINK_ELEMENTS.include?(node.name)

    nil
  end

  # The page is written out as UTF-8, and says so first.
  def declare_utf8
    meta = Nokogiri::XML::Node.new("meta", @doc)
    meta["charset"] = "utf-8"
    (@doc.at_css("head") || @doc.root).prepend_child(meta)
  end

  def fetch_text(url)
    response = fetch(url, accept: "text/css") or return
    response.body.dup.force_encoding(Encoding::UTF_8).scrub("")
  end

  # The bundle file for the resource at `href`, fetched once however often the page uses it.
  def fetch_file(href, base_url, accept: nil)
    url = absolute_http(base_url, href) or return
    return @fetched[url] if @fetched.key?(url)

    response = fetch(url, accept:)
    @fetched[url] = response && add_file(response)
  end

  def add_file(response)
    name = "asset-#{@files.size + 1}#{EXTENSIONS.fetch(response.content_type.to_s, '')}"
    @files[name] = response.body.b
    name
  end

  def fetch(url, accept:)
    return if @attempts >= MAX_FILES || @bytes >= MAX_TOTAL_BYTES || monotonic_time >= @deadline

    @attempts += 1
    response = @http.get(url, max_bytes: [ MAX_FILE_BYTES, MAX_TOTAL_BYTES - @bytes ].min, accept:, deadline: @deadline)
    @bytes += response.body.bytesize
    response
  rescue SafeHttp::Error => e
    Rails.logger.info("[PageBundle] skipped a page resource (#{e.class.name})")
    nil
  end

  def absolute_http(base_url, href)
    uri = URI.join(base_url, href.to_s.strip)
    uri.to_s if uri.is_a?(URI::HTTP) && uri.host.present?
  rescue URI::Error, ArgumentError
    nil
  end

  def monotonic_time
    Process.clock_gettime(Process::CLOCK_MONOTONIC)
  end
end
