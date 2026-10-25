class CreateCooks < ActiveRecord::Migration[8.1]
  def change
    create_table :cooks do |t|
      t.references :recipe, null: false, foreign_key: { on_delete: :cascade }
      t.datetime :cooked_at, null: false
      t.timestamps
    end
    add_index :cooks, %i[recipe_id cooked_at]

    add_column :recipes, :cooks_count, :integer, default: 0, null: false
    add_column :recipes, :edited_at, :datetime
  end
end
