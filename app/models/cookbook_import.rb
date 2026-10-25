# An uploaded cookbook export being added to this cookbook. CookbookImportJob
# runs it; the upload is deleted once it's done.
class CookbookImport < ApplicationRecord
  STATUSES = %w[queued running done failed].freeze
  # A worker that died mid-import never finishes it. Don't let that block new imports forever.
  STALE_AFTER = 1.hour

  has_one_attached :archive

  validates :status, inclusion: { in: STATUSES }

  scope :in_progress, -> { where(status: %w[queued running]).where(updated_at: STALE_AFTER.ago..) }

  def in_progress?
    status.in?(%w[queued running])
  end
end
