# Prints a recipe's source page to PDF, so the recipe keeps a copy of the page if the site changes or
# disappears. Opt-in (SIZZLE_PAGE_PDFS) because it runs a browser on pages from the open web.
#
# The browser is Gotenberg's Chromium, in its own container on a network with no route out, with
# JavaScript off and file access limited to its temporary folder (see docker-compose.yml). Sizzle never
# lets it fetch anything: PageBundle downloads what the page needs through SafeHttp and hands Gotenberg a
# self-contained bundle. The PDF that comes back is checked before it's stored.
class PagePdf
  class Error < StandardError; end

  MAX_PDF_BYTES = 25.megabytes
  RENDER_SECONDS = 90
  CONVERT_PATH = "/forms/chromium/convert/html".freeze
  OPTIONS = {
    "paperWidth" => "8.5", "paperHeight" => "11", "printBackground" => "true", "emulatedMediaType" => "screen"
  }.freeze

  # Link and action entries in the PDF. Every link must be http(s), and PDFs may not carry scripts or
  # launch actions; PageBundle already removed them, this checks what the renderer produced.
  PDF_URI = %r{/URI\s*(\(|<)}
  PDF_HTTP_URI = %r{/URI\s*\(https?:}
  PDF_ACTIONS = %r{/(JavaScript|JS|Launch|SubmitForm|ImportData|GoToR|GoToE)\b}

  def initialize(http: SafeHttp.new, renderer: renderer_http, renderer_url: Sizzle.gotenberg_url)
    @http = http
    @renderer = renderer
    @renderer_url = renderer_url
  end

  # Fetches the recipe's source page through SafeHttp and attaches a PDF of it to the recipe.
  def attach(recipe)
    response = PageScraper.download(recipe.source_url, http: @http)
    pdf = render(html: response.body, url: response.url)
    recipe.page_pdf.attach(io: StringIO.new(pdf), filename: "#{recipe.title.truncate(120, omission: '')}.pdf",
                           content_type: "application/pdf", identify: false)
  end

  # Returns PDF bytes for `html`, as if it had been served from `url`.
  def render(html:, url:)
    bundle = PageBundle.new(http: @http).build(html, url:)
    response = @renderer.post_form(URI.join(@renderer_url, CONVERT_PATH).to_s, form(bundle), max_bytes: MAX_PDF_BYTES)
    check!(response.body.b)
  rescue SafeHttp::Error => e
    raise Error, "the PDF renderer didn't print the page (#{e.class.name.demodulize})"
  end

  private

  # Gotenberg runs on Sizzle's private Docker network, so this connection allows private addresses. Its
  # URL comes from configuration, never from a page.
  def renderer_http
    SafeHttp.new(allow_private: true, read_timeout: RENDER_SECONDS, total_timeout: RENDER_SECONDS)
  end

  def form(bundle)
    files = { "index.html" => bundle.html.b }.merge(bundle.files)
    files.map { |name, bytes| [ "files", bytes, name ] } + OPTIONS.to_a
  end

  def check!(pdf)
    raise Error, "the renderer didn't return a PDF" unless pdf.start_with?("%PDF-".b)
    raise Error, "the PDF is larger than #{MAX_PDF_BYTES / 1.megabyte} MB" if pdf.bytesize > MAX_PDF_BYTES
    raise Error, "the PDF contains a link that isn't http(s)" if pdf.scan(PDF_URI).size != pdf.scan(PDF_HTTP_URI).size
    raise Error, "the PDF contains a script or action" if pdf.match?(PDF_ACTIONS)

    pdf
  end
end
