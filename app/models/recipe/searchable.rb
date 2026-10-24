# Keeps the `recipe_search` FTS5 table in sync and exposes `Recipe.search`.
module Recipe::Searchable
  extend ActiveSupport::Concern

  included do
    after_save_commit :index_for_search
    after_destroy_commit :remove_from_search_index
  end

  class_methods do
    # Matches every word (prefix match), ordered by relevance. User input is
    # reduced to plain word tokens so FTS query syntax can't be injected.
    def search(query)
      fts_query = to_fts_query(query)
      return none if fts_query.blank?

      joins("JOIN recipe_search ON recipe_search.rowid = recipes.id")
        .where("recipe_search MATCH ?", fts_query)
        .reorder(Arel.sql("recipe_search.rank"))
    end

    def to_fts_query(query)
      query.to_s.scan(/[\p{L}\p{N}]+/).first(12).map { |token| %("#{token}"*) }.join(" ")
    end

    def rebuild_search_index!
      connection.execute("DELETE FROM recipe_search")
      find_each(&:index_for_search)
    end
  end

  def index_for_search
    remove_from_search_index
    self.class.connection.execute(self.class.sanitize_sql_array([
      "INSERT INTO recipe_search (rowid, title, description, ingredients, tags, notes) VALUES (?, ?, ?, ?, ?, ?)",
      id, title, description,
      Array(ingredients).map { |line| line["item"] }.compact.join("\n"),
      [ *tags, *diets, cuisine, course, main_ingredient ].compact.join(" "),
      notes
    ]))
  end

  def remove_from_search_index
    self.class.connection.execute(self.class.sanitize_sql_array([ "DELETE FROM recipe_search WHERE rowid = ?", id ]))
  end
end
