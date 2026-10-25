# Tracks each time a recipe was made ("I made this").
module Recipe::Cookable
  extend ActiveSupport::Concern

  included do
    has_many :cooks, dependent: :delete_all
  end

  def cooked!(at: Time.current)
    cooks.create!(cooked_at: at)
  end

  def last_cook
    cooks.order(cooked_at: :desc, id: :desc).first
  end
end
