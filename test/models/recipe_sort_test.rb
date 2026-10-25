require "test_helper"

class RecipeSortTest < ActiveSupport::TestCase
  test "each order is deterministic, keeps filters and omits archived recipes" do
    apple = Recipe.create!(title: "apple", course: "main", created_at: 3.days.ago)
    berry = Recipe.create!(title: "Berry", course: "main", created_at: 2.days.ago)
    curry = Recipe.create!(title: "Curry", course: "main", created_at: 1.day.ago)
    Recipe.create!(title: "Archived", course: "main", archived_at: Time.current)
    Recipe.create!(title: "Dessert", course: "dessert")
    apple.cooked!(at: 1.hour.ago)
    berry.cooked!(at: 1.day.ago)
    berry.cooked!(at: 2.days.ago)

    assert_equal [ curry, berry, apple ], Recipe.filter_by({ course: "main" }, sort: "newest")
    assert_equal [ apple, berry, curry ], Recipe.filter_by({ course: "main" }, sort: "alphabetical")
    assert_equal [ apple, berry, curry ], Recipe.filter_by({ course: "main" }, sort: "recently_cooked")
    assert_equal [ curry, berry, apple ], Recipe.filter_by({ course: "main" }, sort: "never_cooked")
    assert_equal [ curry, berry, apple ], Recipe.filter_by({ course: "main" }, sort: "title; DROP TABLE recipes")
    assert_equal [ apple, berry, curry ], Recipe.filter_by({ q: "main", course: "main" }, sort: "alphabetical")
  end

  test "all saved sort orders keep seasonal SOS picks ahead of all-year recipes" do
    all_year = Recipe.create!(title: "Apple sandwich", meal_times: %w[lunch], created_at: 1.day.ago)
    soup = Recipe.create!(title: "Bean soup", meal_times: %w[lunch dinner], seasons: %w[autumn], created_at: 2.days.ago)
    stew = Recipe.create!(title: "Zucchini stew", meal_times: %w[lunch], seasons: %w[autumn winter], created_at: 3.days.ago)
    Recipe.create!(title: "Summer salad", meal_times: %w[lunch], seasons: %w[summer])
    all_year.cooked!(at: 1.hour.ago)
    soup.cooked!(at: 1.day.ago)
    filters = { meal: "lunch", season: "autumn" }

    %w[newest alphabetical recently_cooked].each do |sort|
      assert_equal [ soup, stew, all_year ], Recipe.filter_by(filters, sort:).to_a, sort
    end
    assert_equal [ stew, soup, all_year ], Recipe.filter_by(filters, sort: "never_cooked").to_a
  end
end
