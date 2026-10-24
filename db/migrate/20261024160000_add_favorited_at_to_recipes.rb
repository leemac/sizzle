class AddFavoritedAtToRecipes < ActiveRecord::Migration[8.1]
  def change
    add_column :recipes, :favorited_at, :datetime
    add_index :recipes, :favorited_at
  end
end
