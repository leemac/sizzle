class AddDismissedAtToImports < ActiveRecord::Migration[8.1]
  def change
    # A dismissed failure stays in the import history but no longer asks for attention.
    add_column :imports, :dismissed_at, :datetime
  end
end
