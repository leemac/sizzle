# A regular, CSRF-protected form download, with the same access as the cookbook.
class CookbookExportsController < ApplicationController
  rate_limit to: 3, within: 1.minute, only: :create

  def create
    download = CookbookExportRunner.new.build
    response.headers["Content-Type"] = "application/gzip"
    response.headers["Content-Disposition"] = ActionDispatch::Http::ContentDisposition.format(
      disposition: "attachment", filename: "sizzle-cookbook-#{Date.current.iso8601}.tar.gz"
    )
    response.headers["Cache-Control"] = "no-store"
    response.headers["Content-Length"] = download.size.to_s
    self.response_body = download
  rescue CookbookExport::Error => e
    redirect_to settings_path, alert: e.message, status: :see_other
  rescue SystemCallError, IOError
    redirect_to settings_path, alert: "The cookbook couldn't be exported. Check available disk space and try again.", status: :see_other
  end
end
