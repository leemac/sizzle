namespace :sizzle do
  desc "Preview plain ingredient parsing (APPLY=1 writes changes)"
  task reparse_ingredients: :environment do
    apply = ENV["APPLY"] == "1"
    puts apply ? "Applying ingredient parsing" : "Dry run: set APPLY=1 to write changes"
    Recipe.find_each do |recipe|
      # Re-read under the write lock so a concurrent edit cannot be overwritten.
      recipe.with_lock do
        changes = []
        ingredients = Array(recipe.ingredients).map do |ingredient|
          next ingredient unless ingredient.values_at("quantity", "quantity_max", "unit", "preparation", "note").all?(&:nil?)
          next ingredient unless ingredient["item"].is_a?(String) && ingredient["item"].present?

          parsed = RecipeText.ingredient(ingredient["item"])
          next ingredient unless parsed

          updated = ingredient.merge(parsed.except("section"))
          changes << [ ingredient, updated ] if updated != ingredient
          updated
        end
        next if changes.empty?

        puts "Recipe #{recipe.id}: #{recipe.title.inspect}"
        changes.each { |before, after| puts "  #{before.to_json} → #{after.to_json}" }
        recipe.update!(ingredients:) if apply
      end
    end
  end
end
