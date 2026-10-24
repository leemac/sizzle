# Gallery filtering and the facet counts that drive the filter UI. Both leave out
# archived recipes.
module Recipe::Filterable
  extend ActiveSupport::Concern

  FILTER_KEYS = %i[q favorites course cuisine diet main max_minutes].freeze
  MAX_MINUTES_OPTIONS = [ 30, 60, 120 ].freeze

  class_methods do
    def filter_by(filters)
      filters = filters.to_h.symbolize_keys.slice(*FILTER_KEYS).compact_blank
      scope = active.order(created_at: :desc)
      scope = scope.search(filters[:q]) if filters[:q]
      scope = scope.favorites if ActiveModel::Type::Boolean.new.cast(filters[:favorites])
      scope = scope.where(course: filters[:course]) if filters[:course]
      scope = scope.where(cuisine: filters[:cuisine]) if filters[:cuisine]
      scope = scope.where(main_ingredient: filters[:main]) if filters[:main]
      scope = scope.where("total_minutes <= ?", filters[:max_minutes].to_i) if filters[:max_minutes]
      if filters[:diet]
        scope = scope.where("EXISTS (SELECT 1 FROM json_each(recipes.diets) WHERE json_each.value = ?)", filters[:diet])
      end
      scope
    end

    def facets
      {
        favorites: active.favorites.count,
        courses: count_by(:course),
        cuisines: count_by(:cuisine),
        main_ingredients: count_by(:main_ingredient).first(24),
        diets: connection.select_rows(<<~SQL).map { |value, count| { value:, count: } },
          SELECT json_each.value, COUNT(*) FROM recipes, json_each(recipes.diets)
          WHERE recipes.archived_at IS NULL
          GROUP BY json_each.value ORDER BY COUNT(*) DESC
        SQL
        max_minutes: MAX_MINUTES_OPTIONS
      }
    end

    private

    def count_by(column)
      active.where.not(column => nil).group(column).order(Arel.sql("COUNT(*) DESC")).count
        .map { |value, count| { value:, count: } }
    end
  end
end
