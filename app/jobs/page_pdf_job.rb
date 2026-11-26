# Saves a PDF of a recipe's source page after it's imported (SIZZLE_PAGE_PDFS). A recipe without one is
# still a recipe, so a page that can't be fetched or printed is logged and skipped.
class PagePdfJob < ApplicationJob
  queue_as :default

  # One browser at a time, however many links were pasted at once.
  limits_concurrency to: 1, key: "page_pdf", duration: 5.minutes

  discard_on ActiveJob::DeserializationError

  def self.wanted?(recipe)
    Sizzle.page_pdfs? && recipe.source_url.present? && !recipe.page_pdf.attached? &&
      !YoutubeVideo.id_from_url(recipe.source_url)
  end

  def perform(recipe, pdf: PagePdf.new)
    return unless self.class.wanted?(recipe)

    pdf.attach(recipe)
  rescue SafeHttp::Error, PagePdf::Error => e
    Rails.logger.info("[PagePdfJob] no PDF for recipe #{recipe.id} (#{e.class.name})")
  end
end
