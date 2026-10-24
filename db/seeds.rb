# Complete development recipes and bundled photos; no network or API key needed.
# Existing recipes are left alone, apart from the original generic placeholders.
return unless Rails.env.development? || ENV["SEED_ANYWAY"]

JSON.parse(Rails.root.join("db/seeds/recipes.json").read).each do |sample|
  attributes = sample.except("image", "legacy_title")
  legacy_title = sample.fetch("legacy_title", sample.fetch("title"))
  legacy = Recipe.find_by(
    title: legacy_title,
    source_url: "https://example.com/#{legacy_title.parameterize}",
    source_name: "Example Kitchen",
    description: "A sample recipe so you can see how Sizzle looks before importing your own.",
    notes: nil,
    rating: nil
  )
  legacy = nil if legacy&.imports&.exists?

  # A real recipe with the same title always takes priority over a sample.
  existing = Recipe.find_by(title: sample.fetch("title"))
  next if existing && existing != legacy

  recipe = legacy || Recipe.new
  image = Rails.root.join("db/seeds/images", "#{sample.fetch('image')}.webp").binread
  Recipe.transaction do
    recipe.assign_attributes(attributes.merge(
      author: "Sizzle sample kitchen", source_name: "Sizzle sample kitchen", source_url: nil, source_host: nil
    ))
    recipe.cover.attach(io: StringIO.new(image), filename: "#{sample.fetch('image')}.webp", content_type: "image/webp")
    recipe.save!
  end
  puts "Seeded #{recipe.title}"
end
