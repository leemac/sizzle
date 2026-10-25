# Marketing-only samples. Run against a disposable capture database, never a personal cookbook.
abort "Use a disposable development database with SIZZLE_MARKETING_DEMO=1" unless Rails.env.development? && ENV["SIZZLE_MARKETING_DEMO"] == "1"

JSON.parse(File.read(File.join(__dir__, "recipes.json"))).each do |sample|
  recipe = Recipe.find_or_initialize_by(title: sample.fetch("title"), source_name: "Sizzle sample kitchen")
  recipe.assign_attributes(sample.except("slug").merge(author: "Sizzle sample kitchen"))
  image = File.binread(File.join(__dir__, "images", "#{sample.fetch('slug')}.webp"))
  recipe.cover.attach(io: StringIO.new(image), filename: "#{sample.fetch('slug')}.webp", content_type: "image/webp")
  recipe.save!
  puts "Prepared #{recipe.title}"
end
