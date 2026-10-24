class CreateRecipeSearch < ActiveRecord::Migration[8.1]
  def change
    # Full-text index over recipes; rowid == recipes.id. Maintained by Recipe::Searchable.
    create_virtual_table :recipe_search, :fts5,
      [ "title", "description", "ingredients", "tags", "notes", "tokenize='porter unicode61 remove_diacritics 2'" ]
  end
end
