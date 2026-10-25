class AddAiPermissionToImports < ActiveRecord::Migration[8.1]
  def change
    # Existing imports and the share API retain the server's configured behavior.
    # Web requests explicitly capture this browser's permission before enqueueing.
    add_column :imports, :ai_allowed, :boolean, default: true, null: false
  end
end
