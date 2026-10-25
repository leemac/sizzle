class AddUidToRecipes < ActiveRecord::Migration[8.1]
  # A recipe's identity across Sizzle instances. Exports carry it, so importing the
  # same cookbook again, or a recipe someone shared, recognizes what you already have.
  class MigrationRecipe < ActiveRecord::Base
    self.table_name = "recipes"
  end

  def up
    add_column :recipes, :uid, :string
    MigrationRecipe.reset_column_information
    MigrationRecipe.where(uid: nil).find_each { |recipe| recipe.update_columns(uid: SecureRandom.uuid) }
    change_column_null :recipes, :uid, false
    add_index :recipes, :uid, unique: true
  end

  def down
    remove_index :recipes, :uid
    remove_column :recipes, :uid
  end
end
