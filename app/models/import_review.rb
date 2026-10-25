# A read-only plan for the web form. Rebuild it on confirmation: a client may
# choose sources from this paste, but never supply a recipe ID to restore.
class ImportReview
  Entry = Data.define(:key, :import, :occurrences, :recipe, :pending_id)

  attr_reader :entries

  def initialize(batch)
    groups = batch.imports.select { |import| import.kind == "url" }.group_by { |import| Import.source_key(import.url) }
    recipes = Recipe.where(source_url: groups.keys).index_by(&:source_url)
    recipes.merge!(historical_sources(groups.keys - recipes.keys))
    pending = pending_sources(groups.keys - recipes.keys)

    @entries = groups.map do |key, imports|
      Entry.new(key:, import: imports.first, occurrences: imports.sum { |import| batch.url_counts.fetch(import.url, 1) },
                recipe: recipes[key], pending_id: pending[key])
    end
    @text_imports = batch.imports.select { |import| import.kind == "text" }
  end

  def needed?
    entries.any? { |entry| entry.occurrences > 1 || entry.recipe || entry.pending_id }
  end

  def token
    # Bind confirmation to the paste and its current matches. If a recipe was
    # deleted/archived or a pending import finished, show the updated choices.
    snapshot = entries.map { |entry| [ entry.key, entry.occurrences, entry.recipe&.id, entry.recipe&.archived?, entry.pending_id ] }
    Rails.application.message_verifier(:import_review).generate(snapshot)
  end

  def imports(selected_keys = nil)
    entries.filter_map do |entry|
      entry.import if entry.recipe.nil? && entry.pending_id.nil? && (selected_keys.nil? || selected_keys.include?(entry.key))
    end + @text_imports
  end

  def save(selected_keys = nil)
    Import.transaction do
      imports(selected_keys).each(&:save!)
      restored = entries.filter_map { |entry| entry.recipe if entry.recipe&.archived? && selected_keys&.include?(entry.key) }.uniq(&:id)
      restored.each(&:unarchive!)
      restored.size
    end
  end

  private

  # Redirects can save a recipe under a different canonical URL. Normalize the
  # stored alias before matching, too: raw SQL URL equality would miss earlier
  # tracking variants. Scan only the needed columns in batches, retain at most
  # one ID per requested source, then load only the matching recipes.
  def historical_sources(keys)
    aliases = {}
    return aliases if keys.empty?

    Import.where(kind: "url", status: "done").where.not(recipe_id: nil).select(:id, :url, :recipe_id).find_each do |import|
      key = Import.source_key(import.url)
      aliases[key] ||= import.recipe_id if keys.include?(key)
      break if aliases.size == keys.size
    end
    recipes = Recipe.where(id: aliases.values).index_by(&:id)
    aliases.transform_values { |id| recipes[id] }.compact
  end

  # Tracking parameters and YouTube aliases also occur in the pending queue.
  # Scan in batches, retaining at most one match per source in this paste.
  def pending_sources(keys)
    matches = {}
    return matches if keys.empty?

    Import.pending.where(kind: "url").select(:id, :url).find_each do |import|
      key = Import.source_key(import.url)
      matches[key] ||= import.id if keys.include?(key)
      break if matches.size == keys.size
    end
    matches
  end
end
