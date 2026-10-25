require "digest"

# Only digests reach the database. The pairing code is single-use; the resulting
# credential can only submit imports through Api::ShortcutImportsController.
class ShortcutConnection < ApplicationRecord
  PAIRING_LIFETIME = 5.minutes
  MAX_CONNECTIONS = 50

  validates :name, presence: true, length: { maximum: 60 }

  scope :visible, -> { where(revoked_at: nil).where("connected_at IS NOT NULL OR pairing_expires_at > ?", Time.current) }

  def self.issue!(name:)
    transaction do
      where(connected_at: nil).where("pairing_expires_at <= ?", Time.current).delete_all
      where.not(revoked_at: nil).delete_all
      raise ArgumentError, "Disconnect a shortcut before connecting another." if count >= MAX_CONNECTIONS

      pairing_token = SecureRandom.hex(32)
      connection = create!(name:, pairing_digest: digest(pairing_token), pairing_expires_at: PAIRING_LIFETIME.from_now)
      [ connection, pairing_token ]
    end
  end

  def self.redeem(pairing_token)
    return unless pairing_token.is_a?(String) && pairing_token.match?(/\A[0-9a-f]{64}\z/)

    credential = "szsc_#{SecureRandom.hex(32)}"
    # One conditional write, so simultaneous redemptions cannot both succeed.
    claimed = where(pairing_digest: digest(pairing_token), connected_at: nil, revoked_at: nil)
      .where("pairing_expires_at > ?", Time.current)
      .update_all(pairing_digest: nil, credential_digest: digest(credential), connected_at: Time.current, updated_at: Time.current)
    credential if claimed == 1
  end

  def self.authenticate(credential)
    return unless credential.is_a?(String) && credential.match?(/\Aszsc_[0-9a-f]{64}\z/)

    find_by(credential_digest: digest(credential), revoked_at: nil)
  end

  def revoke!
    update!(revoked_at: Time.current, credential_digest: nil, pairing_digest: nil)
  end

  def self.digest(value)
    Digest::SHA256.hexdigest(value)
  end
  private_class_method :digest
end
