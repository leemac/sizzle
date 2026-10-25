# Gallery filtering and the facet counts that drive the filter UI. Both leave out
# archived recipes. A season filter keeps all-year recipes too, with the ones made
# for that season first.
module Recipe::Filterable
  extend ActiveSupport::Concern

  FILTER_KEYS = %i[q favorites course cuisine diet main max_minutes meal season].freeze
  MAX_MINUTES_OPTIONS = [ 30, 60, 120 ].freeze
  # Matches recipes whose JSON list holds the bound value.
  HAS_DIET = "EXISTS (SELECT 1 FROM json_each(recipes.diets) WHERE json_each.value = ?)".freeze
  HAS_MEAL_TIME = "EXISTS (SELECT 1 FROM json_each(recipes.meal_times) WHERE json_each.value = ?)".freeze
  IN_SEASON = "json_array_length(recipes.seasons) = 0 OR " \
              "EXISTS (SELECT 1 FROM json_each(recipes.seasons) WHERE json_each.value = ?)".freeze
  LIST_JOINS = {
    diets: "JOIN json_each(recipes.diets) AS item",
    meal_times: "JOIN json_each(recipes.meal_times) AS item"
  }.freeze

  class_methods do
    def filter_by(filters = {}, sort: "newest", **criteria)
      filters = filters.to_h.merge(criteria).symbolize_keys.slice(*FILTER_KEYS).compact_blank
      scope = active
      scope = scope.search(filters[:q]) if filters[:q]
      scope = scope.favorites if ActiveModel::Type::Boolean.new.cast(filters[:favorites])
      scope = scope.where(course: filters[:course]) if filters[:course]
      scope = scope.where(cuisine: filters[:cuisine]) if filters[:cuisine]
      scope = scope.where(main_ingredient: filters[:main]) if filters[:main]
      scope = scope.where("total_minutes <= ?", filters[:max_minutes].to_i) if filters[:max_minutes]
      scope = scope.where(HAS_DIET, filters[:diet]) if filters[:diet]
      scope = scope.where(HAS_MEAL_TIME, filters[:meal]) if filters[:meal]
      scope = scope.where(IN_SEASON, filters[:season]) if filters[:season]
      order = case sort
      when "alphabetical" then Arel.sql("recipes.title COLLATE NOCASE ASC, recipes.id DESC")
      when "recently_cooked" then Arel.sql("(SELECT MAX(cooked_at) FROM cooks WHERE cooks.recipe_id = recipes.id) DESC, recipes.id DESC")
      when "never_cooked" then Arel.sql("CASE WHEN recipes.cooks_count = 0 THEN 0 ELSE 1 END ASC, recipes.created_at DESC, recipes.id DESC")
      else { created_at: :desc, id: :desc }
      end
      # Keep the season's recipes ahead of all-year ones, then apply this
      # browser's chosen order within each group (also replacing search rank).
      seasonal_order = Arel.sql("json_array_length(recipes.seasons) = 0") if filters[:season]
      scope.reorder(seasonal_order).order(order)
    end

    def facets
      {
        favorites: active.favorites.count,
        courses: count_by(:course),
        cuisines: count_by(:cuisine),
        main_ingredients: count_by(:main_ingredient).first(24),
        diets: count_each(:diets),
        meal_times: count_each(:meal_times).sort_by { |facet| Recipe::MEAL_TIMES.index(facet[:value]).to_i },
        seasons: Recipe::SEASONS,
        max_minutes: MAX_MINUTES_OPTIONS
      }
    end

    private

    def count_each(column)
      active.joins(LIST_JOINS.fetch(column))
        .group("item.value").order(Arel.sql("COUNT(*) DESC")).count
        .map { |value, count| { value:, count: } }
    end

    def count_by(column)
      active.where.not(column => nil).group(column).order(Arel.sql("COUNT(*) DESC")).count
        .map { |value, count| { value:, count: } }
    end
  end
end
