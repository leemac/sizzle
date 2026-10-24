class CreateImports < ActiveRecord::Migration[8.1]
  def change
    create_table :imports do |t|
      t.string :kind, null: false          # url | text
      t.string :origin, null: false        # web | share | email
      t.string :url
      t.text :text
      t.string :status, null: false, default: "queued"
      t.string :error
      t.references :recipe, foreign_key: { on_delete: :nullify }
      t.datetime :finished_at

      t.timestamps
    end

    add_index :imports, :status
    add_index :imports, :created_at
  end
end
