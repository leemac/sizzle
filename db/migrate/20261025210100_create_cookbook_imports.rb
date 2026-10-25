class CreateCookbookImports < ActiveRecord::Migration[8.1]
  def change
    create_table :cookbook_imports do |t|
      t.string :status, null: false, default: "queued"
      t.integer :imported_count, null: false, default: 0
      t.integer :skipped_count, null: false, default: 0
      t.integer :rejected_count, null: false, default: 0
      t.string :error
      t.datetime :finished_at
      t.timestamps
    end
  end
end
