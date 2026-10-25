class CreateShortcutConnections < ActiveRecord::Migration[8.1]
  def change
    create_table :shortcut_connections do |t|
      t.string :name, null: false
      t.string :pairing_digest
      t.datetime :pairing_expires_at, null: false
      t.string :credential_digest
      t.datetime :connected_at
      t.datetime :revoked_at
      t.timestamps
    end

    add_index :shortcut_connections, :pairing_digest, unique: true
    add_index :shortcut_connections, :credential_digest, unique: true
  end
end
