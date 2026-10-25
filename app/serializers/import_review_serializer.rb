module ImportReviewSerializer
  extend self

  def call(review)
    {
      token: review.token,
      entries: review.entries.map do |entry|
        {
          key: entry.key, url: entry.import.url, occurrences: entry.occurrences,
          recipe_id: entry.recipe&.id, recipe_title: entry.recipe&.title,
          archived: entry.recipe&.archived? || false, pending_id: entry.pending_id
        }
      end
    }
  end
end
