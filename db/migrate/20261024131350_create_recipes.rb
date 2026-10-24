class CreateRecipes < ActiveRecord::Migration[8.1]
  def change
    create_table :recipes do |t|
      t.string :title, null: false
      t.text :description
      t.string :author

      t.string :source_url
      t.string :source_host
      t.string :source_name

      t.integer :servings
      t.string :yield_text
      t.integer :prep_minutes
      t.integer :cook_minutes
      t.integer :total_minutes

      t.string :cuisine
      t.string :course
      t.string :main_ingredient
      t.json :diets, null: false, default: []
      t.json :tags, null: false, default: []

      # [{ section, quantity, quantity_max, unit, item, preparation, note }]
      t.json :ingredients, null: false, default: []
      # [{ section, text }]
      t.json :steps, null: false, default: []
      t.json :tips, null: false, default: []

      t.text :notes
      t.integer :rating

      t.timestamps
    end

    add_index :recipes, :source_url
    add_index :recipes, :cuisine
    add_index :recipes, :course
    add_index :recipes, :main_ingredient
    add_index :recipes, :total_minutes
    add_index :recipes, :created_at
  end
end
