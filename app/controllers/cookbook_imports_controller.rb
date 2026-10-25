# Uploads a Sizzle cookbook export to add its recipes here. Off unless
# SIZZLE_COOKBOOK_IMPORT is set (see SECURITY.md).
class CookbookImportsController < InertiaController
  rate_limit to: 3, within: 1.minute, only: :create
  before_action { head :not_found unless Sizzle.cookbook_import? }

  def create
    file = params[:archive]
    unless file.is_a?(ActionDispatch::Http::UploadedFile) && file.size.between?(1, CookbookArchive::MAX_UPLOAD_BYTES) && CookbookArchive.gzip?(file)
      return redirect_to settings_path, inertia: { errors: { archive: "Choose a Sizzle cookbook export (.tar.gz) up to #{CookbookArchive::MAX_UPLOAD_BYTES / 1.megabyte} MB." } }
    end
    if CookbookImport.in_progress.exists?
      return redirect_to settings_path, inertia: { errors: { archive: "A cookbook is already importing. Wait for it to finish, then try again." } }
    end

    # Never keep the uploaded file name: it's chosen by whoever sent the file.
    cookbook_import = CookbookImport.create!(archive: { io: file, filename: "cookbook.tar.gz", content_type: "application/gzip", identify: false })
    CookbookImportJob.perform_later(cookbook_import)
    redirect_to settings_path, notice: "Importing your cookbook. Progress shows under Your data."
  end
end
