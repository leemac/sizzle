# Development seed data: a handful of recipes so the UI can be worked on
# without a Claude API key. Images are generated colour fields, not photos.
# Run with `bin/rails db:seed` (safe to re-run; it skips existing titles).
return unless Rails.env.development? || ENV["SEED_ANYWAY"]

def placeholder_image(rgb)
  base = Vips::Image.black(1200, 1500).new_from_image(rgb)
  shade = Vips::Image.xyz(1200, 1500)[1].linear(0.05, 0).cast(:uchar)
  (base - shade.bandjoin([ shade, shade ])).cast(:uchar).webpsave_buffer(Q: 80)
end

SEEDS = [
  { title: "Weeknight Chickpea Curry", cuisine: "Indian", course: "main", total_minutes: 30, prep_minutes: 10,
    cook_minutes: 20, servings: 4, diets: %w[vegan gluten-free], main_ingredient: "chickpeas",
    tags: %w[weeknight one-pot], color: [ 214, 160, 60 ] },
  { title: "Crispy Smashed Potatoes with Herby Yogurt", cuisine: "American", course: "side", total_minutes: 55,
    servings: 4, diets: %w[vegetarian gluten-free], main_ingredient: "potatoes", tags: %w[crispy], color: [ 196, 170, 110 ] },
  { title: "Charred Broccoli Orecchiette", cuisine: "Italian", course: "main", total_minutes: 25, servings: 2,
    diets: %w[vegetarian], main_ingredient: "pasta", tags: %w[weeknight], color: [ 110, 140, 80 ] },
  { title: "Brown Butter Banana Bread", cuisine: "American", course: "baking", total_minutes: 75, servings: 10,
    diets: %w[vegetarian], main_ingredient: "bananas", tags: %w[make-ahead], color: [ 150, 100, 60 ] },
  { title: "Pad Kra Pao", cuisine: "Thai", course: "main", total_minutes: 20, servings: 2, diets: [],
    main_ingredient: "pork", tags: %w[weeknight spicy], color: [ 170, 80, 50 ] },
  { title: "Shakshuka", cuisine: "Middle Eastern", course: "breakfast", total_minutes: 35, servings: 3,
    diets: %w[vegetarian gluten-free], main_ingredient: "eggs", tags: %w[one-pot brunch], color: [ 190, 60, 45 ] },
  { title: "Miso Glazed Salmon", cuisine: "Japanese", course: "main", total_minutes: 20, servings: 2,
    diets: %w[pescatarian dairy-free], main_ingredient: "salmon", tags: %w[weeknight], color: [ 220, 120, 90 ] },
  { title: "Lemon Olive Oil Cake", cuisine: "Italian", course: "dessert", total_minutes: 70, servings: 8,
    diets: %w[vegetarian dairy-free], main_ingredient: "lemons", tags: %w[make-ahead], color: [ 235, 205, 100 ] }
].freeze

SEEDS.each do |attributes|
  next if Recipe.exists?(title: attributes[:title])

  recipe = Recipe.create!(
    **attributes.except(:color),
    description: "A sample recipe so you can see how Sizzle looks before importing your own.",
    source_url: "https://example.com/#{attributes[:title].parameterize}",
    source_name: "Example Kitchen",
    ingredients: [
      { section: nil, quantity: 2, quantity_max: nil, unit: "tbsp", item: "olive oil", preparation: nil, note: nil },
      { section: nil, quantity: 1, quantity_max: nil, unit: nil, item: "onion", preparation: "finely chopped", note: nil },
      { section: nil, quantity: 3, quantity_max: 4, unit: "clove", item: "garlic", preparation: "grated", note: nil },
      { section: "To finish", quantity: 0.5, quantity_max: nil, unit: "cup", item: "fresh herbs", preparation: "chopped",
        note: "parsley, cilantro or a mix" },
      { section: "To finish", quantity: nil, quantity_max: nil, unit: nil, item: "flaky salt", preparation: nil,
        note: "to taste" }
    ],
    steps: [
      { section: nil, text: "Warm the oil in a wide pan over medium heat. Add the onion and a pinch of salt and cook until soft and golden, about 8 minutes." },
      { section: nil, text: "Stir in the garlic and cook for 1 minute, until fragrant." },
      { section: nil, text: "Add the main ingredients and cook until done, adjusting the heat as needed." },
      { section: "To finish", text: "Scatter over the herbs and flaky salt. Serve straight away." }
    ],
    tips: [ "Keeps in the fridge for up to 3 days.", "Double the herbs if you like it bright." ]
  )
  recipe.cover.attach(io: StringIO.new(placeholder_image(attributes[:color])), filename: "cover.webp",
                      content_type: "image/webp")
  puts "Seeded #{recipe.title}"
end
