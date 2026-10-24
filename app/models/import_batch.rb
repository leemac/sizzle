# What the Add recipe form submits: one link, recipe text, or several links
# pasted together (one per line), which become one import each. Saved
# all-or-nothing, so one bad link doesn't leave half a batch queued.
class ImportBatch
  include ActiveModel::Model

  # Every link is a fetch and possibly a Claude call; keep one paste bounded.
  MAX_LINKS = 20

  attr_reader :imports

  validate :within_link_limit
  validate :every_import_valid

  def initialize(input, origin:)
    super()
    links = input.to_s.split
    @imports = if links.many? && links.all? { |link| link.match?(Import::LINK) }
      links.uniq.first(MAX_LINKS + 1).map { |url| Import.new(kind: "url", url:, origin:) }
    else
      [ Import.from_input(input, origin:) ]
    end
  end

  def save
    return false unless valid?

    Import.transaction { imports.each(&:save!) }
    true
  end

  private

  def within_link_limit
    errors.add(:base, "Paste up to #{MAX_LINKS} links at a time.") if imports.size > MAX_LINKS
  end

  def every_import_valid
    return if errors.any?

    invalid = imports.find(&:invalid?) or return
    message = invalid.errors.full_messages.to_sentence
    errors.add(:base, imports.one? ? message : "#{invalid.url.truncate(100)}: #{message}")
  end
end
