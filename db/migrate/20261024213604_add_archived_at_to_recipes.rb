class AddArchivedAtToRecipes < ActiveRecord::Migration[8.1]
  def change
    add_column :recipes, :archived_at, :datetime
    add_index :recipes, :archived_at
  end
end
