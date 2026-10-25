class AddMealTimesAndSeasonsToRecipes < ActiveRecord::Migration[8.1]
  # A starting point for recipes saved before meal times existed, from their
  # course. Copied rather than read from Recipe so this migration never changes.
  COURSE_MEAL_TIMES = {
    "breakfast" => %w[breakfast], "main" => %w[lunch dinner], "soup" => %w[lunch dinner],
    "salad" => %w[lunch dinner], "side" => %w[lunch dinner], "appetizer" => %w[snack],
    "snack" => %w[snack], "baking" => %w[snack]
  }.freeze
  SEASON_TAGS = { "spring" => "spring", "summer" => "summer", "autumn" => "autumn", "fall" => "autumn", "winter" => "winter" }.freeze

  def change
    add_column :recipes, :meal_times, :json, default: [], null: false
    add_column :recipes, :seasons, :json, default: [], null: false

    reversible do |direction|
      direction.up { backfill }
    end
  end

  private

  def backfill
    select_rows("SELECT id, course, tags FROM recipes").each do |id, course, tags|
      meal_times = COURSE_MEAL_TIMES.fetch(course.to_s, [])
      seasons = parsed_tags(tags).filter_map { |tag| SEASON_TAGS[tag.to_s.downcase] }.uniq
      next if meal_times.empty? && seasons.empty?

      execute <<~SQL.squish
        UPDATE recipes SET meal_times = #{quote(meal_times.to_json)}, seasons = #{quote(seasons.to_json)}
        WHERE id = #{Integer(id)}
      SQL
    end
  end

  def parsed_tags(tags)
    Array(JSON.parse(tags.to_s))
  rescue JSON::ParserError
    []
  end
end
