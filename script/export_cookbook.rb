# Internal entry point used only by CookbookExportRunner, with a generated path.
# Rails runner has already booted the app; no user input becomes code or a path.
abort unless ARGV.one?

begin
  ActiveRecord::Base.connection.execute("PRAGMA query_only = ON")
  File.open(ARGV.fetch(0), "wb") { |file| CookbookExport.new.write_to(file) }
rescue CookbookExport::TooLarge, Errno::EFBIG
  exit 2
rescue StandardError
  # The parent reports a useful, fixed error without logging recipe contents.
  exit 1
end
