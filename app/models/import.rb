# One request to turn something (a shared URL, pasted text) into a Recipe.
# Created by the web UI, the share API or the mailbox poller; processed by ImportJob.
class Import < ApplicationRecord
  KINDS = %w[url text].freeze
  ORIGINS = %w[web share email].freeze
  STATUSES = %w[queued fetching extracting saving done failed].freeze
  PENDING_STATUSES = %w[queued fetching extracting saving].freeze
  MAX_TEXT_LENGTH = 100_000

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
    if input.match?(%r{\Ahttps?://\S+\z}i)
      new(kind: "url", url: input, origin:)
    else
      new(kind: "text", text: input, origin:)
    end
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

  private

  def enqueue
    ImportJob.perform_later(self)
  end

  def url_is_fetchable
    SafeHttp.new.validate_uri!(url)
  rescue SafeHttp::BlockedUrl => e
    errors.add(:url, e.message)
  end
end
