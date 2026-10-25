# When a recipe is worth cooking: the meals it suits and the seasons it's best in.
# No seasons means it's good all year. Drives the SOS button's "what can I make
# right now?" view.
module Recipe::Timely
  extend ActiveSupport::Concern

  MEAL_TIMES = %w[breakfast lunch dinner snack].freeze
  SEASONS = %w[spring summer autumn winter].freeze
  SEASON_ALIASES = { "fall" => "autumn" }.freeze

  # A starting point when nothing more specific is known.
  COURSE_MEAL_TIMES = {
    "breakfast" => %w[breakfast], "main" => %w[lunch dinner], "soup" => %w[lunch dinner],
    "salad" => %w[lunch dinner], "side" => %w[lunch dinner], "appetizer" => %w[snack],
    "snack" => %w[snack], "baking" => %w[snack]
  }.freeze

  included do
    validate :meal_times_and_seasons_are_known
  end

  class_methods do
    def meal_times_for_course(course)
      COURSE_MEAL_TIMES.fetch(course.to_s, [])
    end

    # Known seasons from free text such as tags or schema.org keywords. All four
    # seasons is the same as none: good all year.
    def seasons_from(values)
      seasons = Array(values).filter_map do |value|
        next unless value.is_a?(String)

        word = value.strip.downcase
        SEASON_ALIASES.fetch(word, word).presence_in(SEASONS)
      end.uniq
      seasons.size == SEASONS.size ? [] : SEASONS & seasons
    end
  end

  private

  def meal_times_and_seasons_are_known
    { meal_times: MEAL_TIMES, seasons: SEASONS }.each do |attribute, known|
      values = public_send(attribute)
      next errors.add(attribute, "must be a list") unless values.is_a?(Array)

      unknown = values - known
      errors.add(attribute, "contains unknown values: #{unknown.join(', ')}") if unknown.any?
    end
  end
end
