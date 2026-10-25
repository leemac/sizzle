# Loads a Sizzle cookbook export into the local development database, so a preview shows real recipes.
# Development only: Sizzle can't restore exports yet, and this skips photos, history and dedupe.
#
#   bin/rails runner .claude/skills/sizzle-preview/scripts/load_cookbook.rb path/to/cookbook.json
abort "Development only" unless Rails.env.development?

book = JSON.parse(File.read(ARGV.fetch(0)))
skip = %w[id created_at updated_at archived_at favorited_at edited_at cover photos cooks source_host source_name video_metadata]
columns = Recipe.column_names - skip

book.fetch("recipes").each do |data|
  next if Recipe.exists?(title: data["title"])

  attributes = data.slice(*columns)
  attributes["course"] = nil unless Recipe::COURSES.include?(attributes["course"])
  Recipe.create!(attributes)
  puts "Loaded #{data['title']}"
end
