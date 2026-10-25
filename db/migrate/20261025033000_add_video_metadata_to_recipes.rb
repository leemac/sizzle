class AddVideoMetadataToRecipes < ActiveRecord::Migration[8.1]
  def change
    add_column :recipes, :video_metadata, :json, default: {}, null: false
  end
end
