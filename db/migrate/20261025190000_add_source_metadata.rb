class AddSourceMetadata < ActiveRecord::Migration[8.1]
  def change
    add_column :imports, :source_metadata, :json, default: {}, null: false
    add_column :recipes, :source_metadata, :json, default: {}, null: false
  end
end
