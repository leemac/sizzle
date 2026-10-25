# One time a recipe was made. The recipe keeps a count (cooks_count) for the gallery.
class Cook < ApplicationRecord
  belongs_to :recipe, counter_cache: true

  validates :cooked_at, presence: true
end
