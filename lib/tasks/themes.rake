namespace :themes do
  desc "Redraw the README's theme graphic from config/themes.json"
  task preview: :environment do
    ThemePreview.write
    puts "Wrote #{ThemePreview.path('light').relative_path_from(Rails.root)} and #{ThemePreview.path('dark').relative_path_from(Rails.root)}"
  end
end
