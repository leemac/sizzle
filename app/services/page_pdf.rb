require "ferrum"

# Prints a recipe's source page to PDF with headless Chromium, so the recipe keeps a copy of the page if
# the site changes or disappears. Opt-in (SIZZLE_PAGE_PDFS) because it runs a browser on hostile HTML.
#
# Chromium never touches the network itself:
#
# * JavaScript is off, so the page can't run code, open sockets or rewrite itself
# * every request is paused (CDP Fetch domain) and answered by Resources: the page from the HTML we already
#   fetched, stylesheets, images and fonts through SafeHttp, everything else refused
# * anything that slips past interception (preconnects, prefetches) goes to a dead proxy, and the
#   browser's own DNS resolves nothing
# * Chromium's default flags are replaced, so site isolation stays on and background services stay off
class PagePdf
  class Error < StandardError; end

  MAX_PDF_BYTES = 25.megabytes
  RENDER_SECONDS = 60
  PAPER = { paper_width: 8.5, paper_height: 11, print_background: true }.freeze

  # Every element Chromium turns into a PDF link, SVG's xlink:href included.
  LINK_SELECTOR = "a[href], area[href], a[*|href]".freeze

  # Everything the browser could reach without asking us is pointed at nothing.
  DEAD_PROXY = "http://127.0.0.1:9".freeze

  FLAGS = {
    "headless" => nil,
    "blink-settings" => "scriptEnabled=false",
    "proxy-server" => DEAD_PROXY,
    "proxy-bypass-list" => "<-loopback>",
    "host-resolver-rules" => "MAP * ~NOTFOUND",
    "disable-background-networking" => nil,
    "disable-breakpad" => nil,
    "disable-client-side-phishing-detection" => nil,
    "disable-component-update" => nil,
    "disable-crash-reporter" => nil,
    "disable-default-apps" => nil,
    "disable-dev-shm-usage" => nil,
    "disable-domain-reliability" => nil,
    "disable-extensions" => nil,
    "disable-features" => "Translate,OptimizationHints,MediaRouter,InterestFeedContentSuggestion,AutofillServerCommunication",
    "disable-gpu" => nil,
    "disable-sync" => nil,
    "hide-scrollbars" => nil,
    "metrics-recording-only" => nil,
    "mute-audio" => nil,
    "no-default-browser-check" => nil,
    "no-first-run" => nil,
    "password-store" => "basic",
    "remote-allow-origins" => "http://127.0.0.1",
    "safebrowsing-disable-auto-update" => nil,
    "use-mock-keychain" => nil
  }.freeze

  def self.available?(browser_path: Sizzle.chromium_path)
    browser_path ? File.executable?(browser_path) : Ferrum::Browser::Options::Chrome.options.detect_path.present?
  end

  def initialize(http: SafeHttp.new, browser_path: Sizzle.chromium_path, sandbox: Sizzle.chromium_sandbox?)
    @http = http
    @browser_path = browser_path
    @sandbox = sandbox
  end

  # Fetches the recipe's source page through SafeHttp and attaches a PDF of it to the recipe.
  def attach(recipe)
    response = PageScraper.download(recipe.source_url, http: @http)
    pdf = render(html: response.body, url: response.url)
    recipe.page_pdf.attach(io: StringIO.new(pdf), filename: "#{recipe.title.truncate(120, omission: '')}.pdf",
                           content_type: "application/pdf", identify: false)
  end

  # Returns PDF bytes for `html`, rendered as if it had been served from `url`.
  def render(html:, url:)
    deadline = monotonic_time + RENDER_SECONDS
    resources = Resources.new(http: @http, html:, deadline:)

    Dir.mktmpdir("sizzle-pdf") do |home|
      browser = launch(home)
      begin
        page = browser.create_page
        page.command("Emulation.setScriptExecutionDisabled", value: true)
        page.network.intercept
        page.on(:request) { |request| resources.answer(request) }
        page.go_to(url)
        page.command("Emulation.setEmulatedMedia", media: "screen")
        pdf = print(page)
      ensure
        browser.quit
      end
      check!(pdf)
    end
  rescue Ferrum::Error => e
    Rails.logger.info("[PagePdf] browser failed (#{e.class.name}: #{e.message.to_s.truncate(200)})")
    raise Error, "couldn't print the page (#{e.class.name.demodulize})"
  end

  private

  # Chromium copies every link into the PDF, javascript: and data: ones included, and the PDF is served
  # from Sizzle's own origin. Only links that resolve to http(s) are kept. This uses the DOM domain,
  # which works with the page's scripts turned off.
  def remove_unsafe_links(page)
    document = page.command("DOM.getDocument", depth: 0).fetch("root")
    base_url = document["baseURL"].presence || document["documentURL"]
    links = page.command("DOM.querySelectorAll", nodeId: document.fetch("nodeId"), selector: LINK_SELECTOR)
    links.fetch("nodeIds").each do |node_id|
      attributes = page.command("DOM.getAttributes", nodeId: node_id).fetch("attributes").each_slice(2)
      attributes.each do |name, value|
        next unless name.casecmp?("href") || name.downcase.end_with?(":href")
        next if http_link?(base_url, value)

        page.command("DOM.removeAttribute", nodeId: node_id, name:)
      end
    end
  end

  def http_link?(base_url, href)
    %w[http https].include?(URI.join(base_url, href.strip).scheme&.downcase)
  rescue URI::Error, ArgumentError
    false
  end

  # A navigation the page starts after loading (a meta refresh, say) is answered with 204, but until that
  # settles the document can't always be printed or edited. Let refused requests settle, and try again if that
  # happens. Links are always removed before printing; if that keeps failing, nothing is printed.
  def print(page)
    attempts = 0
    begin
      attempts += 1
      wait_for_idle(page)
      remove_unsafe_links(page)
      page.pdf(encoding: :binary, **PAPER).to_s.b
    rescue Ferrum::BrowserError
      retry if attempts < 3
      raise
    end
  end

  # Returns nil after 5 seconds, and what has loaded is printed.
  def wait_for_idle(page)
    page.network.wait_idle(timeout: 5, interval: 0.2)
  end

  def launch(home)
    flags = FLAGS.merge("user-data-dir" => File.join(home, "profile"))
    flags.merge!("no-sandbox" => nil) unless @sandbox
    Ferrum::Browser.new(
      browser_path: @browser_path,
      ignore_default_browser_options: true,
      browser_options: flags,
      window_size: [ 1280, 1600 ],
      timeout: 30,
      process_timeout: 20,
      # A read-only container only lets the browser write to its temporary home.
      env: { "HOME" => home, "XDG_CONFIG_HOME" => home, "XDG_CACHE_HOME" => home }
    )
  end

  def check!(pdf)
    raise Error, "the browser didn't return a PDF" unless pdf.start_with?("%PDF-".b)
    raise Error, "the PDF is larger than #{MAX_PDF_BYTES / 1.megabyte} MB" if pdf.bytesize > MAX_PDF_BYTES

    pdf
  end

  def monotonic_time
    Process.clock_gettime(Process::CLOCK_MONOTONIC)
  end

  # Answers each request the browser makes while printing. Only the page itself and the files it needs to
  # look right (stylesheets, images, fonts) are fetched, each through SafeHttp and inside shared budgets.
  class Resources
    FETCHED_TYPES = { "Stylesheet" => "text/css", "Image" => "image/", "Font" => nil }.freeze
    MAX_RESOURCES = 120
    MAX_RESOURCE_BYTES = 5.megabytes
    MAX_TOTAL_BYTES = 40.megabytes
    CONTENT_TYPE = %r{\A[a-z0-9.+-]+/[a-z0-9.+-]+\z}i

    attr_reader :fetched

    def initialize(http:, html:, deadline:)
      @http = http
      @html = html.to_s.b
      @deadline = deadline
      @document_served = false
      @fetched = 0
      @bytes = 0
    end

    # `request` is a Ferrum::Network::InterceptedRequest (or anything with url, method, resource_type,
    # respond and abort). Every request is answered; none is ever continued to the network.
    def answer(request)
      if request.resource_type == "Document"
        answer_document(request)
      elsif (response = fetch(request))
        request.respond(body: response.body.b, responseHeaders: content_type_header(response))
      else
        request.abort
      end
    rescue StandardError => e
      Rails.logger.info("[PagePdf] refused a page resource (#{e.class.name})")
      request.abort unless request.respond_to?(:handled?) && request.handled?
    end

    private

    # The first document requested is always the navigation `render` started. Frames, meta refreshes and
    # any later navigation get 204 No Content: the browser stays on the page instead of swapping in an
    # error page, and nothing is fetched.
    def answer_document(request)
      if @document_served
        request.respond(responseCode: 204, body: "")
      else
        @document_served = true
        request.respond(body: @html, responseHeaders: { "Content-Type" => document_content_type })
      end
    end

    def fetch(request)
      return unless request.method == "GET" && FETCHED_TYPES.key?(request.resource_type)
      return unless request.url.to_s.start_with?("http://", "https://")
      return if @fetched >= MAX_RESOURCES || @bytes >= MAX_TOTAL_BYTES

      @fetched += 1
      max_bytes = [ MAX_RESOURCE_BYTES, MAX_TOTAL_BYTES - @bytes ].min
      response = @http.get(request.url, max_bytes:, accept: FETCHED_TYPES.fetch(request.resource_type), deadline: @deadline)
      @bytes += response.body.bytesize
      response
    rescue SafeHttp::Error => e
      Rails.logger.info("[PagePdf] skipped a page resource (#{e.class.name})")
      nil
    end

    # SafeHttp keeps no charset, so UTF-8 is declared only when the page is valid UTF-8. Anything else is
    # left to the page's own <meta charset>.
    def document_content_type
      @html.dup.force_encoding(Encoding::UTF_8).valid_encoding? ? "text/html; charset=utf-8" : "text/html"
    end

    def content_type_header(response)
      type = response.content_type.to_s.split(";").first.to_s.strip
      type.match?(CONTENT_TYPE) ? { "Content-Type" => type } : {}
    end
  end
end
