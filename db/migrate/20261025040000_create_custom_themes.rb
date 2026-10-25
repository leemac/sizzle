class CreateCustomThemes < ActiveRecord::Migration[8.1]
  def change
    create_table :custom_themes do |t|
      t.string :name, null: false
      t.string :description
      t.json :light, null: false
      t.json :dark, null: false
      t.timestamps
    end
  end
end
