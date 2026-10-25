# One request to turn something (a shared URL, pasted text) into a Recipe.
# Created by the web UI, the share API or the mailbox poller; processed by ImportJob.
class Import < ApplicationRecord
  KINDS = %w[url text].freeze
  ORIGINS = %w[web share email].freeze
  STATUSES = %w[queued fetching extracting saving done failed].freeze
  PENDING_STATUSES = %w[queued fetching extracting saving].freeze
  MAX_TEXT_LENGTH = 100_000
  LINK = %r{\Ahttps?://\S+\z}i

  belongs_to :recipe, optional: true

  validates :kind, inclusion: { in: KINDS }
  validates :origin, inclusion: { in: ORIGINS }
  validates :status, inclusion: { in: STATUSES }
  validates :url, presence: true, length: { maximum: 2048 }, if: -> { kind == "url" }
  validates :text, presence: true, length: { maximum: MAX_TEXT_LENGTH }, if: -> { kind == "text" }
  validate :url_is_fetchable, if: -> { kind == "url" && url.present? }

  scope :pending, -> { where(status: PENDING_STATUSES) }
  scope :recent, -> { order(created_at: :desc) }

  after_create_commit :enqueue

  # Builds an import from free-form input: a bare URL becomes a URL import,
  # anything else is treated as recipe text.
  def self.from_input(input, origin:)
    input = input.to_s.strip
    if input.match?(LINK)
      new(kind: "url", url: input, origin:)
    else
      new(kind: "text", text: input, origin:)
    end
  end

  # Match the worker's identity without fetching the page. Tracking links and
  # the different YouTube URL forms all refer to the same source.
  def self.source_key(url)
    video_id = YoutubeVideo.id_from_url(url)
    Recipe.normalize_url(video_id ? YoutubeVideo.watch_url(video_id) : url)
  end

  def pending?
    status.in?(PENDING_STATUSES)
  end

  def advance!(status)
    update!(status:)
  end

  def succeed!(recipe)
    update!(status: "done", recipe:, error: nil, finished_at: Time.current)
  end

  def fail!(message)
    update!(status: "failed", error: message.to_s.truncate(500), finished_at: Time.current)
  end

  def retry!
    return unless status == "failed"

    update!(status: "queued", error: nil, finished_at: nil)
    enqueue
  end

  # Solid Queue records a killed worker's execution as failed outside perform,
  # so ImportJob's rescue cannot update our status. ReconcileImportsJob runs
  # this every minute to catch those failures. Match job IDs so an old failure
  # cannot overwrite a new retry, and leave running/scheduled jobs alone.
  def self.reconcile_failed_jobs!
    return unless ImportJob.queue_adapter.is_a?(ActiveJob::QueueAdapters::SolidQueueAdapter)

    # Imports queued before job tracking was introduced can still be matched to
    # their latest Solid Queue job by Active Job's serialized GlobalID.
    pending.where(active_job_id: nil).find_each do |import|
      job_id = SolidQueue::Job.where(class_name: "ImportJob")
        .where("json_extract(arguments, '$.arguments[0]._aj_globalid') = ?", import.to_global_id.to_s)
        .order(id: :desc).pick(:active_job_id)
      import.update_column(:active_job_id, job_id) if job_id
    end

    ids = pending.where.not(active_job_id: nil).pluck(:active_job_id)
    return if ids.empty?

    failed_ids = SolidQueue::Job.joins(:failed_execution).where(active_job_id: ids).pluck(:active_job_id)
    pending.where(active_job_id: failed_ids).update_all(
      status: "failed", error: "Importing was interrupted. Please retry.",
      finished_at: Time.current, updated_at: Time.current
    )
  end

  private

  def enqueue
    job = ImportJob.new(self)
    update_column(:active_job_id, job.job_id)
    job.enqueue
  end

  def url_is_fetchable
    SafeHttp.new.validate_uri!(url)
  rescue SafeHttp::BlockedUrl => e
    errors.add(:url, e.message)
  end
end
